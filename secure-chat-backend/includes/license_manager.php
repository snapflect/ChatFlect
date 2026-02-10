<?php
// includes/license_manager.php
// Epic 67: License Logic

require_once __DIR__ . '/db_connect.php';

class LicenseManager
{
    private $pdo;

    // Feature Matrix
    const PLANS = [
        'FREE' => ['seats' => 5, 'features' => ['basic']],
        'PRO' => ['seats' => 50, 'features' => ['basic', 'exports', 'audit']],
        'ENTERPRISE' => ['seats' => 1000, 'features' => ['basic', 'exports', 'audit', 'sso', 'scim']]
    ];

    public function __construct($pdo)
    {
        $this->pdo = $pdo;
    }

    public function getLicense($orgIdBin)
    {
        $stmt = $this->pdo->prepare("SELECT * FROM org_licenses WHERE org_id = ?");
        $stmt->execute([$orgIdBin]);
        $lic = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$lic) {
            // Default to Free
            return self::PLANS['FREE'];
        }
        return $lic;
    }

    public function checkSeatLimit($orgIdBin)
    {
        $lic = $this->getLicense($orgIdBin);
        if ($lic['subscription_status'] !== 'ACTIVE')
            return false;

        $limit = $lic['seat_limit'];

        // Count Active Members
        $stmt = $this->pdo->prepare("SELECT COUNT(*) FROM org_members WHERE org_id = ? AND status='ACTIVE'");
        $stmt->execute([$orgIdBin]);
        $count = $stmt->fetchColumn();

        return $count < $limit;
    }

    public function updateLicense($orgIdBin, $plan, $seats, $userId = null)
    {
        if (!isset(self::PLANS[$plan]))
            throw new Exception("Invalid Plan");

        // Get old for audit
        $old = $this->getLicense($orgIdBin);

        // Upsert
        $sql = "INSERT INTO org_licenses (org_id, plan_id, seat_limit) VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE plan_id=VALUES(plan_id), seat_limit=VALUES(seat_limit)";
        $this->pdo->prepare($sql)->execute([$orgIdBin, $plan, $seats]);

        // Audit
        $type = ($seats > ($old['seat_limit'] ?? 0)) ? 'UPGRADE' : 'DOWNGRADE'; // Simple heuristic
        $this->logEvent($orgIdBin, $type, $old['plan_id'] ?? 'NONE', $plan, $userId);
    }

    private function logEvent($orgIdBin, $type, $old, $new, $userId)
    {
        $stmt = $this->pdo->prepare("INSERT INTO org_license_events (org_id, event_type, old_plan, new_plan, performed_by) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([$orgIdBin, $type, $old, $new, $userId]);
    }
}
