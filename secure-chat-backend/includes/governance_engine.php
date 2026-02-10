<?php
// includes/governance_engine.php
// Epic 58: Governance Logic
// Evaluates policies and manages the approval workflow.

require_once __DIR__ . '/db_connect.php';

class GovernanceEngine
{
    private $pdo;
    private $identityMgr;

    public function __construct($pdo)
    {
        $this->pdo = $pdo;
        require_once __DIR__ . '/admin_identity_manager.php';
        $this->identityMgr = new AdminIdentityManager($pdo);
    }

    public function getPolicy($actionType)
    {
        $stmt = $this->pdo->prepare("SELECT * FROM governance_policies WHERE action_type = ?");
        $stmt->execute([$actionType]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    public function requestAction($adminId, $actionType, $target, $reason)
    {
        $policy = $this->getPolicy($actionType);
        if (!$policy)
            throw new Exception("Unknown Action Type: $actionType");

        // HF-58.5: Policy Change Governance
        if ($actionType === 'POLICY_CHANGE' && $policy['is_locked']) {
            // Special high-security check could go here
        }

        // Calculate Expiry
        $hours = $policy['auto_expire_hours'] ?? 24;
        $expiry = date('Y-m-d H:i:s', strtotime("+$hours hours"));
        $targetJson = is_array($target) ? json_encode($target) : $target;
        $createdAt = date('Y-m-d H:i:s');

        // HF-58.4: Immutable Action Hashing
        // hash = sha256(type + target + requester + reason + created_at)
        $raw = $actionType . $targetJson . $adminId . $reason . $createdAt;
        $hash = hash('sha256', $raw);

        $stmt = $this->pdo->prepare("INSERT INTO admin_action_queue (action_type, target_resource, requester_id, reason, expires_at, created_at, action_hash) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([$actionType, $targetJson, $adminId, $reason, $expiry, $createdAt, $hash]);

        return $this->pdo->lastInsertId();
    }

    public function approveAction($requestId, $approverId)
    {
        // 1. Fetch Request
        $stmt = $this->pdo->prepare("SELECT * FROM admin_action_queue WHERE request_id = ? FOR UPDATE");
        $stmt->execute([$requestId]);
        $req = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$req)
            throw new Exception("Request Not Found");
        if ($req['status'] !== 'PENDING')
            throw new Exception("Request is not PENDING (Status: {$req['status']})");
        if ($req['requester_id'] == $approverId)
            throw new Exception("Self-approval forbidden");
        if (strtotime($req['expires_at']) < time()) {
            $this->updateStatus($requestId, 'EXPIRED');
            throw new Exception("Request Expired");
        }

        // Verify Hash Integrity
        $currentRaw = $req['action_type'] . $req['target_resource'] . $req['requester_id'] . $req['reason'] . $req['created_at'];
        if (hash('sha256', $currentRaw) !== $req['action_hash']) {
            throw new Exception("INTEGRITY COMPROMISED: Request has been tampered with.");
        }

        // 2. Fetch Policy
        $policy = $this->getPolicy($req['action_type']);

        // 3. Record Approval
        $meta = json_decode($req['approval_metadata'] ?? '[]', true);
        if (in_array($approverId, array_column($meta, 'id')))
            throw new Exception("Already approved by you");

        $meta[] = ['id' => $approverId, 'time' => date('c')];
        $newMeta = json_encode($meta);

        // 4. Check Quorum & Roles
        $count = count($meta);
        $roleSatisfied = false;
        $requiredRole = $policy['required_role'] ?? 'ANY';

        if ($requiredRole === 'ANY') {
            $roleSatisfied = true;
        } else {
            // Check if any approver has the required role
            foreach ($meta as $approval) {
                if ($this->identityMgr->verifyRole($approval['id'], $requiredRole)) {
                    $roleSatisfied = true;
                    break;
                }
            }
        }

        if ($count >= $policy['min_approvers'] && $roleSatisfied) {
            $stmtUpd = $this->pdo->prepare("UPDATE admin_action_queue SET status = 'APPROVED', approval_metadata = ? WHERE request_id = ?");
            $stmtUpd->execute([$newMeta, $requestId]);
            return 'APPROVED';
        } else {
            $stmtUpd = $this->pdo->prepare("UPDATE admin_action_queue SET approval_metadata = ? WHERE request_id = ?");
            $stmtUpd->execute([$newMeta, $requestId]);
            return 'PENDING_MORE_APPROVALS';
        }
    }

    public function rejectAction($requestId, $rejectorId, $reason)
    {
        $stmt = $this->pdo->prepare("UPDATE admin_action_queue SET status = 'REJECTED', rejection_reason = ? WHERE request_id = ?");
        $stmt->execute([$reason, $requestId]);
    }

    public function executeAction($requestId)
    {
        // Mark as EXECUTED. Actual logic execution is handled by caller or a job runner.
        // In this synchronous MVP, the caller checks 'APPROVED' and runs the logic, then marks 'EXECUTED'.
        $this->updateStatus($requestId, 'EXECUTED');
    }

    private function updateStatus($id, $status)
    {
        $stmt = $this->pdo->prepare("UPDATE admin_action_queue SET status = ? WHERE request_id = ?");
        $stmt->execute([$status, $id]);
    }
}
