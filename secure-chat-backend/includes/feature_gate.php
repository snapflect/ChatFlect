<?php
// includes/feature_gate.php
// Epic 68: Unified Feature Gate

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/license_manager.php';
require_once __DIR__ . '/feature_registry.php';

class FeatureGate
{
    private $pdo;

    public function __construct($pdo)
    {
        $this->pdo = $pdo;
    }

    public function check($orgIdBin, $featureKey)
    {
        if (!FeatureRegistry::isValid($featureKey))
            return false; // Unknown feature

        // 1. Check License Plan Entitlement
        $licMgr = new LicenseManager($this->pdo);
        $lic = $licMgr->getLicense($orgIdBin);

        if ($lic['subscription_status'] !== 'ACTIVE') {
            // Expired? Only FREE features allowed?
            // Simplified: If expired, block premium features.
            // Check if feature is allowed in FREE? Or block all 'Premium'?
            // Logic: Get entitlements for current plan.
        }

        $plan = $lic['plan_id'];

        // Check DB Entitlements (Cacheable)
        $stmt = $this->pdo->prepare("SELECT is_allowed FROM feature_entitlements WHERE plan_id = ? AND feature_key = ?");
        $stmt->execute([$plan, $featureKey]);
        $allowed = $stmt->fetchColumn();

        if ($allowed === false) {
            // fallback to defaults if not in DB, but DB should have it.
            // If not found, assume DENY.
            return false;
        }
        if (!$allowed)
            return false;

        // 2. Check Org-Level Feature Flag (Toggle)
        // Default is TRUE if Entitled, unless explicitly DISABLED in flags?
        // Or Default is FALSE until ENABLED?
        // Strategy: "Entitled" means "Available". "Flag" means "On/Off".
        // Usually, Entitled features are On by default, unless Admin turns them off.
        // Let's check if there is an explicit flag setting.

        $stmt = $this->pdo->prepare("SELECT is_enabled FROM feature_flags WHERE org_id = ? AND feature_key = ?");
        $stmt->execute([$orgIdBin, $featureKey]);
        $flag = $stmt->fetchColumn();

        if ($flag !== false) {
            // Explicit setting exists
            return (bool) $flag;
        }

        // Default behavior if not toggled: Enabled if Entitled?
        // Yes, usually.
        return true;
    }

    public static function require($pdo, $orgIdBin, $featureKey)
    {
        $gate = new FeatureGate($pdo);
        if (!$gate->check($orgIdBin, $featureKey)) {
            http_response_code(403);
            echo json_encode(['error' => "Feature '$featureKey' not enabled or not available in current plan"]);
            exit;
        }
    }
}
