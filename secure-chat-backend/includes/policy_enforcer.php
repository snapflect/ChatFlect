<?php
// includes/policy_enforcer.php
// Epic 62: Policy Enforcement Middleware

require_once __DIR__ . '/org_policy_manager.php';
require_once __DIR__ . '/org_manager.php';

class PolicyEnforcer
{
    private $pdo;
    private $policyMgr;
    private $orgMgr;

    public function __construct($pdo)
    {
        $this->pdo = $pdo;
        $this->policyMgr = new OrgPolicyManager($pdo);
        $this->orgMgr = new OrgManager($pdo); // To find user's org
    }

    public function checkExport($userId)
    {
        // Find user's org
        // (Simplified: assuming user in 1 org for now, or check context)
        $stmt = $this->pdo->prepare("SELECT org_id FROM org_members WHERE user_id = ? AND status='ACTIVE' LIMIT 1");
        $stmt->execute([$userId]);
        $orgIdBin = $stmt->fetchColumn();

        if ($orgIdBin) {
            $policy = $this->policyMgr->getActivePolicy($orgIdBin);
            if (isset($policy['allow_exports']) && $policy['allow_exports'] === false) {
                throw new Exception("Export blocked by Organization Policy.");
            }
        }
    }

    public function checkDeviceRegistration($userId)
    {
        // Find Org
        $stmt = $this->pdo->prepare("SELECT org_members.org_id FROM org_members WHERE user_id = ? AND status='ACTIVE' LIMIT 1");
        $stmt->execute([$userId]);
        $orgIdBin = $stmt->fetchColumn();

        if ($orgIdBin) {
            $policy = $this->policyMgr->getActivePolicy($orgIdBin);

            // HF-62.4: Max Devices
            $limit = $policy['max_devices_per_user'] ?? 5;
            $stmt = $this->pdo->prepare("SELECT COUNT(*) FROM devices WHERE user_id = ? AND trust_status != 'REVOKED'");
            $stmt->execute([$userId]);
            $count = $stmt->fetchColumn();

            if ($count >= $limit) {
                throw new Exception("Device Quota Exceeded (Max: $limit)");
            }

            // HF-62.4: Approval Required for new devices?
            // (Caller should handle PENDING state set based on this return or exception)
            return $policy['device_approval_required'] ?? false;
        }
        return false; // Default: No approval needed if not in org
    }
}
