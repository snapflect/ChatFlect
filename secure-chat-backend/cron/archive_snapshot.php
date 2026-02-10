<?php
// cron/archive_snapshot.php
// Epic 64: Monthly Archive Snapshot Generator

require_once __DIR__ . '/../includes/db_connect.php';
require_once __DIR__ . '/../includes/archive_manager.php';

echo "Running Archive Snapshot...\n";

$mgr = new ArchiveManager($pdo);

// Iterate all Orgs
$stmt = $pdo->query("SELECT org_id FROM organizations");
while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    $orgIdBin = $row['org_id'];
    try {
        $id = $mgr->createMonthlySnapshot($orgIdBin);
        echo "Snapshot Created Org " . bin2hex($orgIdBin) . ": $id\n";
    } catch (Exception $e) {
        echo "Error Org " . bin2hex($orgIdBin) . ": " . $e->getMessage() . "\n";
    }
}
echo "Done.\n";
