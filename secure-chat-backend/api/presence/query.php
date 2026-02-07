<?php
// api/presence/query.php
require_once __DIR__ . '/../../includes/db_connect.php';
require_once __DIR__ . '/../auth_middleware.php';

header('Content-Type: application/json');

try {
    // 1. Authenticate Request
    $auth = authenticate_request($pdo);
    $my_user_id = $auth['user_id'];

    // 2. Validate Input (Batch IDs)
    $input = json_decode(file_get_contents('php://input'), true);
    $user_ids = $input['user_ids'] ?? [];

    if (!is_array($user_ids) || count($user_ids) > 100) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid or too many user_ids (limit 100)']);
        exit;
    }

    if (empty($user_ids)) {
        echo json_encode([]);
        exit;
    }

    // 3. Batch Query with Server-side TTL
    // Logic: fetch all devices for these users.
    // If ANY device is online (and not expired), user is 'online'.
    // Return aggregated status per user.

    $placeholders = implode(',', array_fill(0, count($user_ids), '?'));

    // Server-side TTL: 2 minutes
    // If last_seen < NOW - 2min, effectively 'offline'
    $sql = "
        SELECT 
            user_id,
            status,
            last_seen,
            typing_in_chat,
            CASE 
                WHEN last_seen < NOW() - INTERVAL 2 MINUTE THEN 'offline'
                ELSE status 
            END as computed_status
        FROM presence
        WHERE user_id IN ($placeholders)
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($user_ids);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // 4. Aggregation Logic
    $result = [];

    foreach ($user_ids as $uid) {
        // Default to offline
        $result[$uid] = [
            'status' => 'offline',
            'last_seen' => 0,
            'typing_in' => null
        ];
    }

    foreach ($rows as $row) {
        $uid = $row['user_id'];
        $status = $row['computed_status'];
        $last_seen_ts = strtotime($row['last_seen']) * 1000;
        $typing = $row['typing_in_chat'];

        // Aggregate: If ANY device is online, user is online
        // If current stored is offline, and this device is online, upgrade.
        // Also track latest 'last_seen'

        $current = $result[$uid];

        // Upgrade status
        if ($status === 'online' || ($status === 'busy' && $current['status'] !== 'online')) {
            $result[$uid]['status'] = $status;
        }

        // Max last_seen
        if ($last_seen_ts > $current['last_seen']) {
            $result[$uid]['last_seen'] = $last_seen_ts;
        }

        // Typing: If any device is typing, show it
        if ($typing && !$current['typing_in']) {
            $result[$uid]['typing_in'] = $typing;
        }
    }

    echo json_encode($result);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Server error']);
}
