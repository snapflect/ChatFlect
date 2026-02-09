<?php
// cron/license_expiry_enforcer.php
// Epic 67: Daily License Check

require_once __DIR__ . '/../includes/db_connect.php';
require_once __DIR__ . '/../includes/license_manager.php';

echo "Running License Expiry Enforcer...\n";

// Find expiring licenses
// In real world, we check `expires_at < NOW()` and status='ACTIVE'
$stmt = $pdo->query("SELECT org_id FROM org_licenses WHERE subscription_status='ACTIVE' AND expires_at < NOW()");

while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    $orgIdBin = $row['org_id'];
    echo "Expiring License for Org " . bin2hex($orgIdBin) . "\n";

    // Set to EXPIRED
    $update = $pdo->prepare("UPDATE org_licenses SET subscription_status='EXPIRED' WHERE org_id = ?");
    $update->execute([$orgIdBin]);

    // Log Event
    $evt = $pdo->prepare("INSERT INTO org_license_events (org_id, event_type, performed_by) VALUES (?, 'EXPIRE', NULL)");
    $evt->execute([$orgIdBin]);
}

echo "Done.\n";
