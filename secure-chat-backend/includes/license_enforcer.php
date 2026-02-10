<?php
// includes/license_enforcer.php
// Epic 67: Feature Gating Middleware

require_once __DIR__ . '/license_manager.php';

class LicenseEnforcer
{
    private $pdo;

    public function __construct($pdo)
    {
        $this->pdo = $pdo;
    }

    public function requireFeature($orgIdBin, $feature)
    {
        $mgr = new LicenseManager($this->pdo);
        $lic = $mgr->getLicense($orgIdBin);

        // Check Expiry
        if ($lic['subscription_status'] !== 'ACTIVE')
            throw new Exception("Subscription Expired");

        // Check Feature
        // If features stored in DB as JSON, use that. Or use Plan Map.
        $features = [];
        if (!empty($lic['features'])) {
            $features = json_decode($lic['features'], true);
        } else {
            $plan = $lic['plan_id'] ?? 'FREE';
            $features = LicenseManager::PLANS[$plan]['features'] ?? [];
        }

        if (!in_array($feature, $features)) {
            throw new Exception("Feature '$feature' not included in current plan");
        }
    }
}
