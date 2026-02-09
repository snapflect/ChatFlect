<?php
// includes/org_policy_manager.php
// Epic 62: Policy Logic

require_once __DIR__ . '/db_connect.php';

class OrgPolicyManager
{
    private $pdo;

    // Default Policy Template
    const DEFAULTS = [
        'device_approval_required' => false,
        'allow_exports' => true,
        'max_devices_per_user' => 5,
        'retention_days' => 30,
        'require_trusted_device' => false
    ];

    public function __construct($pdo)
    {
        $this->pdo = $pdo;
    }

    public function getActivePolicy($orgIdBin)
    {
        // Fetch latest version
        $stmt = $this->pdo->prepare("SELECT policy_json, version FROM org_policies WHERE org_id = ? ORDER BY version DESC LIMIT 1");
        $stmt->execute([$orgIdBin]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row)
            return self::DEFAULTS; // Return defaults if no custom policy set

        // Merge with defaults to ensure all keys exist
        $custom = json_decode($row['policy_json'], true);
        return array_merge(self::DEFAULTS, $custom);
    }

    public function setPolicy($orgIdBin, $newPolicy, $userId)
    {
        // Validation
        if (isset($newPolicy['max_devices_per_user']) && $newPolicy['max_devices_per_user'] < 1) {
            throw new Exception("Max devices must be at least 1");
        }

        // Get current version to increment
        $stmt = $this->pdo->prepare("SELECT MAX(version) FROM org_policies WHERE org_id = ?");
        $stmt->execute([$orgIdBin]);
        $currentVer = $stmt->fetchColumn() ?: 0;

        $nextVer = $currentVer + 1;
        $json = json_encode($newPolicy);

        $stmt = $this->pdo->prepare("INSERT INTO org_policies (org_id, version, policy_json, created_by_user_id) VALUES (?, ?, ?, ?)");
        $stmt->execute([$orgIdBin, $nextVer, $json, $userId]);

        return $nextVer;
    }

    public function getHistory($orgIdBin)
    {
        $stmt = $this->pdo->prepare("SELECT version, created_at, created_by_user_id FROM org_policies WHERE org_id = ? ORDER BY version DESC");
        $stmt->execute([$orgIdBin]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}
