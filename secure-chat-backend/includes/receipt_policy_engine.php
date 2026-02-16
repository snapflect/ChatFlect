<?php
// includes/receipt_policy_engine.php
// Epic 83: Read Receipt Logic

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/privacy_engine.php';

class ReceiptPolicyEngine
{
    private $pdo;
    private $privacyEngine;

    public function __construct($pdo)
    {
        $this->pdo = $pdo;
        $this->privacyEngine = new PrivacyEngine($pdo);
    }

    public function shouldSendReadReceipt($userId)
    {
        // HF-83.3 Abuse Prevention Hook
        // If traffic padding policy for this user is 'HIGH' (Suspicious), force-off receipts to minimize leakage?
        // Let's assume we can check `TrafficPadder` context or similar service.
        // For now, simple placeholder:
        // if (TrafficPadder::getPolicyLevel($userId) === 'HIGH') return false;

        // 1. Check Org Policy Override (With Caching)
        // $cacheKey = "org_policy:read_receipts:$userId";
        // if ($cached = $this->cache->get($cacheKey)) return ($cached === 'FORCE_ON');

        // Mock Org Lookup for HF-83.1
        // $userOrg = $this->getUserOrg($userId);
        // if ($userOrg) {
        //    $policy = $this->getOrgPolicy($userOrg, 'READ_RECEIPTS');
        //    // Cache result
        //    // $this->cache->set($cacheKey, $policy, 300);
        //    if ($policy === 'FORCE_OFF') return false;
        //    if ($policy === 'FORCE_ON') return true;
        // }

        // 2. Check User Preference
        $settings = $this->privacyEngine->getSettings($userId);

        // If 'read_receipts_enabled' is 1 (TRUE), send it.
        // If 0 (FALSE), suppress.
        // logic: Enabled=1 -> Return True.

        return (bool) $settings['read_receipts_enabled'];
    }

    // Helper to get Org Policy (Mock/Stub)
    private function getOrgPolicy($orgId, $key)
    {
        $stmt = $this->pdo->prepare("SELECT policy_value FROM organization_policies WHERE org_id = ? AND policy_key = ?");
        $stmt->execute([$orgId, $key]);
        return $stmt->fetchColumn();
    }
}
