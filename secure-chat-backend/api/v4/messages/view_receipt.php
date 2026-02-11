<?php
// api/v4/messages/view_receipt.php
require_once __DIR__ . '/../../includes/auth_middleware.php';
require_once __DIR__ . '/../../includes/view_once_manager.php';

$user = authenticate();
$input = json_decode(file_get_contents('php://input'), true);

if (!isset($input['message_id']) || !isset($input['sender_id'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing fields']);
    exit;
}

try {
    // Epic 80: View Receipt
// Epic 83: Read Receipt Toggle Check
    require_once __DIR__ . '/../../includes/receipt_policy_engine.php';

    $rpe = new ReceiptPolicyEngine($pdo);
    if (!$rpe->shouldSendReadReceipt($user['user_id'])) {
        // Suppress BLUE TICK. 
        // BUT: Does this also suppress "Burn on Read" for View Once?
        // CRITICAL: View Once MUST burn regardless of "Blue Tick" setting.
        // If "Read Receipt" is disabled, we usually still BURN View Once, but maybe not send Ack?
        // Security Invariant: "View Once messages... permanently delete...".
        // If we return here, `markViewed` is NOT called!
        // We must call `markViewed` (Burn Logic) but maybe suppress the NOTIFICATION to sender?
        // Actually `markViewed` does the Logic. 
        // Let's check `is_view_once`.

        // We need message ID to check if it's view once.
        // Input has message_id.

        // Fetch if check needed: 
        $check = $pdo->prepare("SELECT is_view_once FROM messages WHERE message_id = ?");
        $check->execute([$input['message_id']]);
        $vo = $check->fetchColumn();

        if (!$vo) {
            // Normal Message: Suppress Receipt
            echo json_encode(['success' => true, 'suppressed' => true]);
            exit;
        }
        // If View Once, PROCEED to burn it. (Blue tick might be implicit or we hide it, but burn is mandatory).
    }

    // 2. Call Manager
    $vom = new ViewOnceManager($pdo);
    // Client sends this when they OPEN the message
    $burned = $vom->markViewed($input['message_id'], $user['user_id'], $input['sender_id']);

    if ($burned) {
        echo json_encode(['success' => true, 'status' => 'burned']);
    } else {
        http_response_code(404);
        echo json_encode(['error' => 'Message not found']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
