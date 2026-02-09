<?php
// cron/org_retention_enforcer.php
// Epic 64: Daily Retention Enforcer

require_once __DIR__ . '/../includes/db_connect.php';
require_once __DIR__ . '/../includes/org_retention_manager.php';
// require_once __DIR__ . '/../includes/disclosures/legal_hold_manager.php'; // Epic 54 dependency

echo "Running Retention Enforcement...\n";

$mgr = new OrgRetentionManager($pdo);

// Iterate all Orgs
$stmt = $pdo->query("SELECT org_id FROM organizations");
while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    $orgIdBin = $row['org_id'];

    // Check Legal Hold (Mock)
    // $holdMgr = new LegalHoldManager($pdo);
    // if ($holdMgr->isUnderHold($orgIdBin)) {
    //     echo "Skipping Org " . bin2hex($orgIdBin) . " (Legal Hold)\n";
    //     continue;
    // }

    try {
        $mgr->enforceRetention($orgIdBin);
        echo "Processed Org " . bin2hex($orgIdBin) . "\n";
    } catch (Exception $e) {
        echo "Error Org " . bin2hex($orgIdBin) . ": " . $e->getMessage() . "\n";
    }
}
echo "Done.\n";
