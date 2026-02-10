<?php
// api/v4/admin/export_governance_bundle.php
// Epic 58 HF 2: Signed Governance Evidence Bundle
// Exports a full audit trail of a governance action, signed by the server.

require_once __DIR__ . '/../../../includes/db_connect.php';
require_once __DIR__ . '/../../../includes/env.php';

header('Content-Type: application/json');

$headers = getallheaders();
if (($headers['X-Admin-Secret'] ?? '') !== getenv('ADMIN_SECRET_KEY')) {
    http_response_code(403);
    echo json_encode(['error' => 'FORBIDDEN']);
    exit;
}

$requestId = $_GET['request_id'] ?? 0;
if (!$requestId) {
    http_response_code(400);
    echo json_encode(['error' => 'MISSING_ID']);
    exit;
}

$stmt = $pdo->prepare("SELECT * FROM admin_action_queue WHERE request_id = ?");
$stmt->execute([$requestId]);
$req = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$req) {
    http_response_code(404);
    echo json_encode(['error' => 'NOT_FOUND']);
    exit;
}

// Build Evidence Package
$evidence = [
    'header' => [
        'generated_at' => date('c'),
        'server_id' => getenv('NODE_ID') ?? 'PRIMARY',
        'bundle_version' => '1.0'
    ],
    'request' => [
        'id' => $req['request_id'],
        'type' => $req['action_type'],
        'target' => $req['target_resource'],
        'requester' => $req['requester_id'],
        'reason' => $req['reason'],
        'created_at' => $req['created_at'],
        'original_hash' => $req['action_hash']
    ],
    'approvals' => json_decode($req['approval_metadata']),
    'status' => $req['status'],
    'execution_context' => [
        'rejection_reason' => $req['rejection_reason']
    ]
];

// Sign it
$json = json_encode($evidence, JSON_PRETTY_PRINT);
$privateKeyPath = __DIR__ . '/../../../keys/server_private.pem';
if (!file_exists($privateKeyPath)) {
    // Dev fallback
    $signature = 'DEV_SIGNATURE_placeholder_SHA256_' . hash('sha256', $json);
} else {
    $pkey = openssl_pkey_get_private(file_get_contents($privateKeyPath));
    openssl_sign($json, $signature, $pkey, OPENSSL_ALGO_SHA256);
    $signature = base64_encode($signature);
}

echo json_encode([
    'evidence' => $evidence,
    'signature' => $signature
]);
