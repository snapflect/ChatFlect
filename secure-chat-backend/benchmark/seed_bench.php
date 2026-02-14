<?php
// benchmark/seed_bench.php
// Pre-provisions test data for benchmarking

require_once __DIR__ . '/../api/db.php';

$pdo = getDbPdo();

echo "Seeding benchmark data...\n";

// 1. Create Benchmark Organization
$orgId = random_bytes(16);
$orgIdHex = bin2hex($orgId);
$stmt = $pdo->prepare("INSERT IGNORE INTO organizations (org_id, name) VALUES (?, ?)");
$stmt->execute([$orgId, 'Benchmark Org']);

echo "Org Created: $orgIdHex\n";

// 2. Create 100 Test Users
$users = [];
$stmtUser = $pdo->prepare("INSERT IGNORE INTO users (user_id, google_sub, org_id, display_name) VALUES (?, ?, ?, ?)");
$stmtDevice = $pdo->prepare("INSERT IGNORE INTO user_devices (user_id, device_uuid, status) VALUES (?, ?, 'active')");

for ($i = 1; $i <= 100; $i++) {
    $userId = "BENCH_USER_" . str_pad($i, 3, '0', STR_PAD_LEFT);
    $sub = "google_bench_" . $i;
    $stmtUser->execute([$userId, $sub, $orgId, "Bench User $i"]);

    $deviceUuid = "BENCH_DEVICE_" . $i;
    $stmtDevice->execute([$userId, $deviceUuid]);

    $users[] = ['user_id' => $userId, 'device_uuid' => $deviceUuid];
}

echo "100 Users and Devices Created.\n";

// 3. Create a Large Broadcast List
$listId = random_bytes(16);
$stmtList = $pdo->prepare("INSERT INTO broadcast_lists (list_id, owner_id, name) VALUES (?, ?, ?)");
$stmtList->execute([$listId, 'BENCH_USER_001', 'Heavy Broadcast']);

$stmtMember = $pdo->prepare("INSERT INTO broadcast_list_members (list_id, member_id) VALUES (?, ?)");
foreach ($users as $user) {
    if ($user['user_id'] === 'BENCH_USER_001')
        continue;
    $stmtMember->execute([$listId, $user['user_id']]);
}

echo "Broadcast List 'Heavy Broadcast' created with 99 members.\n";
echo "Seeding Complete.\n";
echo "List ID: " . bin2hex($listId) . "\n";
echo "Owner: BENCH_USER_001\n";
