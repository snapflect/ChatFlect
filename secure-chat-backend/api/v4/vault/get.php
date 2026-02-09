<?php
// api/v4/vault/get.php
// Epic 69: Create Vault Item

require_once __DIR__ . '/../../includes/auth_middleware.php';
require_once __DIR__ . '/../../includes/vault_manager.php';

$user = authenticate();
$itemId = $_GET['item_id'] ?? 0;

try {
    $masterKey = hash('sha256', $user['user_id'] . getenv('ADMIN_SECRET_KEY'), true);
    $mgr = new VaultManager($pdo, $user['user_id'], $masterKey);

    $item = $mgr->getItem($itemId);

    echo json_encode(['item' => $item]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
