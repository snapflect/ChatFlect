<?php
// api/v4/devices/list.php
// Epic 48: Device Discovery / Sync

require_once __DIR__ . '/../../../includes/db_connect.php';
require_once __DIR__ . '/../../../api/auth_middleware.php';

header('Content-Type: application/json');

try {
    $authData = requireAuth();
    $requesterUserId = strtoupper($authData['user_id']); // "Who is asking?"

    $targetUserId = $_GET['user_id'] ?? $requesterUserId;
    $targetUserId = strtoupper($targetUserId);

    // Privacy Check:
    // 1. If asking for self, return ALL non-revoked devices (including PENDING).
    // 2. If asking for contact, return ONLY TRUSTED devices.

    $isSelf = ($requesterUserId === $targetUserId);

    $query = "SELECT device_id, platform, device_name, public_identity_key, trust_state, last_seen_at 
              FROM devices 
              WHERE user_id = ? AND revoked_at IS NULL";

    if (!$isSelf) {
        $query .= " AND trust_state = 'TRUSTED'";
    } else {
        // Self can see pending
        $query .= " AND trust_state IN ('TRUSTED', 'PENDING')";
    }

    $stmt = $pdo->prepare($query);
    $stmt->execute([$targetUserId]);
    $devices = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'user_id' => $targetUserId,
        'devices' => $devices
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'SERVER_ERROR', 'message' => $e->getMessage()]);
}
