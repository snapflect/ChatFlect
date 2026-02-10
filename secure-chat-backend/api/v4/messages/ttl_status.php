<?php
// api/v4/messages/ttl_status.php
// Epic 70: Check Message TTL Status

require_once __DIR__ . '/../../includes/auth_middleware.php';
require_once __DIR__ . '/../../includes/db_connect.php';

$user = authenticate();
$msgId = $_GET['message_id'];

try {
    $msgIdBin = hex2bin($msgId);

    // Check Queue
    $stmt = $pdo->prepare("SELECT expires_at, status FROM message_expiry_queue WHERE message_id = ?");
    $stmt->execute([$msgIdBin]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        // Either never scheduled (Infinite) OR already processed/deleted?
        // Check if message exists
        $chk = $pdo->prepare("SELECT 1 FROM messages WHERE message_id = ?");
        $chk->execute([$msgIdBin]);
        if ($chk->fetchColumn()) {
            echo json_encode(['status' => 'ACTIVE', 'ttl' => 'INFINITE']);
        } else {
            // Deleted but no queue record? Maybe old message or manual delete.
            echo json_encode(['status' => 'DELETED_OR_UNKNOWN']);
        }
    } else {
        echo json_encode(['status' => $row['status'], 'expires_at' => $row['expires_at']]);
    }

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
