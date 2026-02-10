<?php
// includes/org_retention_manager.php
// Epic 64: Retention Logic

require_once __DIR__ . '/db_connect.php';

class OrgRetentionManager
{
    private $pdo;

    // Global Defaults (if not overridden)
    const GLOBAL_DEFAULTS = [
        'audit_log' => 365,
        'chat_message' => 90,
        'file' => 90,
        'compliance_export' => 30
    ];

    public function __construct($pdo)
    {
        $this->pdo = $pdo;
    }

    public function getRetentionPolicy($orgIdBin)
    {
        $stmt = $this->pdo->prepare("SELECT item_type, retention_days FROM org_retention_policies WHERE org_id = ?");
        $stmt->execute([$orgIdBin]);
        $overrides = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

        return array_merge(self::GLOBAL_DEFAULTS, $overrides);
    }

    public function setRetention($orgIdBin, $itemType, $days, $userId)
    {
        if ($days < 1)
            throw new Exception("Retention must be > 0 days");
        if (!array_key_exists($itemType, self::GLOBAL_DEFAULTS))
            throw new Exception("Invalid item type");

        // Upsert
        $stmt = $this->pdo->prepare("
            INSERT INTO org_retention_policies (org_id, item_type, retention_days, updated_by)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE retention_days = VALUES(retention_days), updated_by = VALUES(updated_by)
        ");
        $stmt->execute([$orgIdBin, $itemType, $days, $userId]);
    }

    public function enforceRetention($orgIdBin)
    {
        $policy = $this->getRetentionPolicy($orgIdBin);

        // 1. Audit Logs
        $limit = date('Y-m-d H:i:s', strtotime("-{$policy['audit_log']} days"));
        // Assuming audit_logs has org_id (via metadata query or column if added).
        // Safest: Only delete if Legal Hold check passes.
        // Assuming LegalHoldManager::isUnderHold($orgIdBin) exists [Epic 54]
        // if ($this->isUnderHold($orgIdBin)) return; 

        // Mock Implementation of Enforce for now:
        error_log("Enforcing Retention for Org " . bin2hex($orgIdBin) . ": Audit Limit $limit");

        // Real implementation would delete from DB/Filesystem here.
    }
}
