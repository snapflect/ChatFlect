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
        // 1. Check Org Policy Override
        // We need user's Org ID. 
        // Mocking Org Lookup or fetch from users table.
        // $userOrg = $this->getUserOrg($userId);
        // if ($userOrg) {
        //    $policy = $this->getOrgPolicy($userOrg, 'READ_RECEIPTS');
        //    if ($policy === 'FORCE_OFF') return false;
        //    if ($policy === 'FORCE_ON') return true;
        // }
        // For MVP/Epic 83, we assume no Override active or implement simple check if table populated.

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
