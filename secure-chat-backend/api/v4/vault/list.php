<?php
// api/v4/vault/list.php
// Epic 69: List Vault Items

require_once __DIR__ . '/../../includes/auth_middleware.php';
require_once __DIR__ . '/../../includes/vault_manager.php';

$user = authenticate();

try {
    $masterKey = hash('sha256', $user['user_id'] . getenv('ADMIN_SECRET_KEY'), true);
    $mgr = new VaultManager($pdo, $user['user_id'], $masterKey);

    $items = $mgr->listItems();

    echo json_encode(['items' => $items]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
