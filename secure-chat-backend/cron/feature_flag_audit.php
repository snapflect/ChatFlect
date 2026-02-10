<?php
// cron/feature_flag_audit.php
// Epic 68: Audit Feature Flags

require_once __DIR__ . '/../includes/db_connect.php';

echo "Running Feature Flag Audit...\n";

// Check for inconsistencies: Enabled flags that are NOT Entitled
// i.e., Plan says NO, but Flag says YES.

// Join flags with entitlements
$sql = "
    SELECT f.org_id, f.feature_key, l.plan_id
    FROM feature_flags f
    JOIN org_licenses l ON f.org_id = l.org_id
    JOIN feature_entitlements e ON l.plan_id = e.plan_id AND f.feature_key = e.feature_key
    WHERE f.is_enabled = 1 AND e.is_allowed = 0
";

$stmt = $pdo->query($sql);
while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    $orgHex = bin2hex($row['org_id']);
    echo "CRITICAL: Org $orgHex has enabled feature '{$row['feature_key']}' which is NOT allowed in plan '{$row['plan_id']}'\n";
    // Autom fix? Or alert?
    // Let's disable it to be safe.
    $udp = $pdo->prepare("UPDATE feature_flags SET is_enabled = 0 WHERE org_id = ? AND feature_key = ?");
    $udp->execute([$row['org_id'], $row['feature_key']]);
    echo "  > Feature automatically disabled.\n";
}

echo "Done.\n";
