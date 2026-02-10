<?php
// api/v4/messages/deletion_receipt.php
// Epic 70: Get Signed Deletion Receipt

require_once __DIR__ . '/../../includes/auth_middleware.php';
require_once __DIR__ . '/../../includes/db_connect.php';

$user = authenticate();
$msgId = $_GET['message_id'];

try {
    // If message is DELETED via TTL, we might store a receipt in a separate table or log.
    // For this epic, we generate it on demand if we can verify deletion?
    // Or we should have stored it when deleting.
    // "When deleted: system emits signed receipt". This implies storage.
    // Let's assume 'message_expiry_queue' status='PROCESSED' implies we can generate a receipt.
    // Or we should have a 'deletion_receipts' table.
    // Let's generate it dynamically if status is PROCESSED, using the Queue data.

    $msgIdBin = hex2bin($msgId);
    $stmt = $pdo->prepare("SELECT conversation_id, expires_at, status FROM message_expiry_queue WHERE message_id = ?");
    $stmt->execute([$msgIdBin]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row || $row['status'] !== 'PROCESSED') {
        throw new Exception("Receipt unavailable (Message active or not expiring)");
    }

    $receipt = [
        'message_id' => $msgId,
        'conversation_id' => bin2hex($row['conversation_id']),
        'deleted_at' => $row['expires_at'], // Approx
        'reason' => 'TTL_EXPIRED',
        'issuer' => 'ChatFlect_Trust_Center'
    ];

    $json = json_encode($receipt);

    // Sign
    $privateKeyPath = __DIR__ . '/../../keys/server_private.pem';
    if (file_exists($privateKeyPath)) {
        $pkey = openssl_pkey_get_private(file_get_contents($privateKeyPath));
        openssl_sign($json, $signature, $pkey, OPENSSL_ALGO_SHA256);
        $receipt['_signature'] = base64_encode($signature);
    }

    echo json_encode($receipt);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
