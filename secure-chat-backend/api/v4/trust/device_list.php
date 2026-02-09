<?php
// api/v4/trust/device_list.php
// Epic 72: Device Trust View

require_once __DIR__ . '/../../includes/auth_middleware.php';
require_once __DIR__ . '/../../includes/db_connect.php';

$user = authenticate();
$contactId = $_GET['user_id']; // Viewing someone else's devices (Public Keys only)

try {
    // Only return Public Key + Trust State + Last Seen
    // Do not return private data.

    $stmt = $pdo->prepare("SELECT device_id, public_key, trust_state, created_at, last_seen_at FROM devices WHERE user_id = ?");
    $stmt->execute([$contactId]);
    $devices = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(['devices' => $devices]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
