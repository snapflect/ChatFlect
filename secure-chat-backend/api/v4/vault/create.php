<?php
// api/v4/vault/create.php
// Epic 69: Create Vault Item

require_once __DIR__ . '/../../includes/auth_middleware.php';
require_once __DIR__ . '/../../includes/vault_manager.php';

$user = authenticate();
$input = json_decode(file_get_contents('php://input'), true);

try {
    // For MVP, assume client derives 'masterKey' from user password/session and sends it?
    // OR Server holds a session-bound secret.
    // In ChatFlect, we assume session token maps to a master key or context on server?
    // "Master identity key" in prompt suggests something tied to Identity.
    // Let's assume for this API, the server uses a user-specific secret from DB (Encrypted KEK) or session.
    // Simplification: Use a stable user secret (e.g. from Users table, not exposed).
    // In real secure vault, Client should do encryption.
    // But prompt says: "Vault Manager... encrypts". So Server-Side Encryption (SSE)
    // using "Master identity key" available to server.
    // We'll simulate this master key using hash of user ID + server secret.

    $masterKey = hash('sha256', $user['user_id'] . getenv('ADMIN_SECRET_KEY'), true);

    $mgr = new VaultManager($pdo, $user['user_id'], $masterKey);

    $id = $mgr->createItem($input['type'], $input['metadata'], $input['payload']);

    echo json_encode(['success' => true, 'item_id' => $id]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
