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

    // Future: checkDeviceLimit, checkRetention, etc.
}
