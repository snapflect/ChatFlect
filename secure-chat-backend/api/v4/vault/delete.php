<?php
// api/v4/vault/delete.php
// Epic 69: Delete Vault Item

require_once __DIR__ . '/../../includes/auth_middleware.php';
require_once __DIR__ . '/../../includes/vault_manager.php';

$user = authenticate();
$input = json_decode(file_get_contents('php://input'), true);
$itemId = $input['item_id'];

try {
    $masterKey = hash('sha256', $user['user_id'] . getenv('ADMIN_SECRET_KEY'), true);
    $mgr = new VaultManager($pdo, $user['user_id'], $masterKey);

    $mgr->deleteItem($itemId);

    echo json_encode(['success' => true]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
