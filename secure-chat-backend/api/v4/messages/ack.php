<?php
// api/v4/messages/ack.php
// Epic 48: Device-Specific Acknowledgement

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

    $pdo->beginTransaction();
    $stmt = $pdo->prepare("UPDATE device_inbox SET status = ? WHERE inbox_id = ? AND recipient_device_id = ?");

    $count = 0;
    foreach ($acks as $ack) {
        $status = $ack['status'] ?? '';
        $id = $ack['inbox_id'] ?? 0;

        if (in_array($status, ['DELIVERED', 'ACKED']) && $id) {
            $stmt->execute([$status, $id, $deviceId]);
            $count += $stmt->rowCount();
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
