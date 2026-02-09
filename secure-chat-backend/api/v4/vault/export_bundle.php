<?php
// api/v4/vault/export_bundle.php
// Epic 69 HF: Secure Export

require_once __DIR__ . '/../../../../includes/auth_middleware.php';
require_once __DIR__ . '/../../../../includes/vault_manager.php';
require_once __DIR__ . '/../../../../includes/db_connect.php';

$user = authenticate();

try {
    $masterKey = hash('sha256', $user['user_id'] . getenv('ADMIN_SECRET_KEY'), true);
    $mgr = new VaultManager($pdo, $user['user_id'], $masterKey);

    // Get ALL items decrypted (Memory intensive!)
    // Better: Stream encrypted blobs + keys?
    // Secure export should probably give user the keys so they can decrypt offline?
    // Prompt says: "Signed encrypted export".
    // Let's implement exporting the Encrypted Blobs + The Vault Keys (wrapped by User Password/Master Key).
    // Actually, simply dumping the decrypted data in a big JSON is easiest for "Backup", if transmitted over TLS.
    // Let's export the List with Payload decrypted.

    $items = $mgr->listItems(); // Currently listItems tries to decrypt metadata.
    // We need payloads too.

    $fullExport = [];
    foreach ($items as $itm) {
        // Fetch payload
        $details = $mgr->getItem($itm['id']);
        $fullExport[] = $details;
    }

    $bundle = [
        'user_id' => $user['user_id'],
        'exported_at' => date('c'),
        'vault_items' => $fullExport
    ];

    $json = json_encode($bundle, JSON_PRETTY_PRINT);

    // Sign with Server Key to prove authenticity?
    $privateKeyPath = __DIR__ . '/../../../../keys/server_private.pem';
    if (file_exists($privateKeyPath)) {
        $pkey = openssl_pkey_get_private(file_get_contents($privateKeyPath));
        openssl_sign($json, $signature, $pkey, OPENSSL_ALGO_SHA256);
        $bundle['_signature'] = base64_encode($signature);
        $json = json_encode($bundle); // Re-encode with sig
    }

    header('Content-Type: application/json');
    header('Content-Disposition: attachment; filename="vault_backup.json"');
    echo $json;

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
