<?php
// api/v4/messages/ack.php
// Epic 48: Device-Specific Acknowledgement
// Epic 49-HF: Hardening (Monotonicity + Markers)

require_once __DIR__ . '/../../../includes/db_connect.php';
require_once __DIR__ . '/../../../api/auth_middleware.php';

header('Content-Type: application/json');

try {
    $authData = requireAuth();
    $deviceId = $authData['device_uuid'] ?? '';

    // Revocation Check
    $stmt = $pdo->prepare("SELECT trust_state FROM devices WHERE device_id = ?");
    $stmt->execute([$deviceId]);
    if ($stmt->fetchColumn() !== 'TRUSTED') {
        http_response_code(403);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $acks = $input['acks'] ?? []; // Array of {inbox_id, status}

    if (empty($acks)) {
        echo json_encode(['success' => true, 'count' => 0]);
        exit;
    }

    // HF-49.1: Monotonic Transition Enforcement
    $allowedTransitions = [
        'PENDING' => ['DELIVERED'],
        'DELIVERED' => ['ACKED', 'READ'],
        'ACKED' => ['READ'],
        'READ' => [] // Terminal state
    ];

    $pdo->beginTransaction();

    // Prepare statements
    // Hardening: Enforce ownership (recipient_device_id must match auth ID)
    $stmtGetStatus = $pdo->prepare("SELECT status, message_uuid FROM device_inbox WHERE inbox_id = ? AND recipient_device_id = ?");
    // Also update expiration on ACK to free up storage sooner (7 days)
    $stmtUpdate = $pdo->prepare("UPDATE device_inbox SET status = ?, expires_at = ? WHERE inbox_id = ?");

    // HF-49.9: Log Security Events
    $stmtLog = $pdo->prepare("INSERT INTO delivery_security_events (event_type, device_id, message_uuid, attempted_state) VALUES ('INVALID_ACK_TRANSITION', ?, ?, ?)");

    // HF-49.4: Marker Update Statement (Read Receipt Convergence)
    $stmtMarker = $pdo->prepare("
        INSERT INTO conversation_device_markers (conversation_id, user_id, device_id, last_read_message_id, updated_at)
        SELECT m.conversation_id, d.user_id, ?, ?, NOW()
        FROM messages m
        JOIN devices d ON d.device_id = ?
        WHERE m.message_uuid = ?
        ON DUPLICATE KEY UPDATE last_read_message_id = VALUES(last_read_message_id), updated_at = NOW()
    ");

    $count = 0;
    foreach ($acks as $ack) {
        $newStatus = $ack['status'] ?? '';
        $id = $ack['inbox_id'] ?? 0;

        if (!$id || !isset($allowedTransitions[$newStatus]))
            continue;

        // Verify current status and ownership
        $stmtGetStatus->execute([$id, $deviceId]);
        $row = $stmtGetStatus->fetch(PDO::FETCH_ASSOC);

        if (!$row)
            continue; // Not found or not owned by this device

        $currentStatus = $row['status'];
        $msgUuid = $row['message_uuid'];

        // Monotonic Check
        // Allow idempotent retry (same status -> same status is OK)
        if ($currentStatus !== $newStatus && !in_array($newStatus, $allowedTransitions[$currentStatus] ?? [])) {
            // Log Security Event
            $stmtLog->execute([$deviceId, $msgUuid, $newStatus]);
            continue; // Skip invalid transition
        }

        if ($currentStatus !== $newStatus) {
            // Shorten retention on ACK (7 days), PENDING (null/long)
            $newExpiry = ($newStatus === 'PENDING') ? null : time() + (7 * 86400);
            $stmtUpdate->execute([$newStatus, $newExpiry, $id]);
            $count++;

            // Update Marker if READ
            if ($newStatus === 'READ') {
                // Determine conversation_id from message_uuid safely
                // This join ensures the message actually exists and links correctly
                $stmtMarker->execute([$deviceId, $msgUuid, $deviceId, $msgUuid]);
            }
        }
    }
    $pdo->commit();

    echo json_encode(['success' => true, 'updated' => $count]);

} catch (Exception $e) {
    if ($pdo->inTransaction())
        $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['error' => 'SERVER_ERROR']);
}
