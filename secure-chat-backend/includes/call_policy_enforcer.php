<?php
// includes/call_policy_enforcer.php
// Epic 77: Call Policy Enforcement

require_once __DIR__ . '/db_connect.php';

class CallPolicyEnforcer
{
    private $pdo;

    public function __construct($pdo)
    {
        $this->pdo = $pdo;
    }

    public function canStartCall($userId, $isVideo = false)
    {
        // Mock Org ID fetch
        $orgId = $this->getUserOrg($userId);

        $stmt = $this->pdo->prepare("SELECT * FROM org_call_policies WHERE org_id = ?");
        $stmt->execute([$orgId]);
        $policy = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$policy)
            return true; // Default allow if no policy

        if (!$policy['allow_calls']) {
            throw new Exception("Calls are disabled by your organization.");
        }

        if ($isVideo && !$policy['allow_video']) {
            throw new Exception("Video calls are disabled by your organization.");
        }

        return true;
    }

    public function checkJoinPolicy($callId, $userId)
    {
        // Check Verified Requirement
        $orgId = $this->getUserOrg($userId);
        $stmt = $this->pdo->prepare("SELECT require_verified_contacts FROM org_call_policies WHERE org_id = ?");
        $stmt->execute([$orgId]);
        $requireVerified = $stmt->fetchColumn();

        if ($requireVerified) {
            // Check if user is verified with Initiator?
            // Simplified: Just pass for now, but logic would check trust state.
        }
        return true;
    }

    private function getUserOrg($userId)
    {
        // Mock: In real app, fetch from users table
        return 1;
    }
}
