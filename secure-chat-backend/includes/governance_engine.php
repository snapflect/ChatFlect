<?php
// includes/governance_engine.php
// Epic 58: Governance Logic
// Evaluates policies and manages the approval workflow.

require_once __DIR__ . '/db_connect.php';

class GovernanceEngine
{
    private $pdo;

    public function __construct($pdo)
    {
        $this->pdo = $pdo;
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

        // Calculate Expiry
        $hours = $policy['auto_expire_hours'] ?? 24;
        $expiry = date('Y-m-d H:i:s', strtotime("+$hours hours"));
        $targetJson = is_array($target) ? json_encode($target) : $target;

        $stmt = $this->pdo->prepare("INSERT INTO admin_action_queue (action_type, target_resource, requester_id, reason, expires_at) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([$actionType, $targetJson, $adminId, $reason, $expiry]);

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

        // 2. Fetch Policy
        $policy = $this->getPolicy($req['action_type']);

        // 3. Record Approval
        $meta = json_decode($req['approval_metadata'] ?? '[]', true);
        if (in_array($approverId, array_column($meta, 'id')))
            throw new Exception("Already approved by you");

        $meta[] = ['id' => $approverId, 'time' => date('c')];
        $newMeta = json_encode($meta);

        // 4. Check Quorum
        $count = count($meta);
        if ($count >= $policy['min_approvers']) {
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
        $this->updateStatus($requestId, 'REJECTED');
        // Log rejection metadata if needed
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
