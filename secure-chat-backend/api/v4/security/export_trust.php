<?php
// api/v4/security/export_trust.php
// HF-55.3: Signed Trust Proof Export
// Returns the actor's trust history in a signed JSON format for dispute resolution.

require_once __DIR__ . '/../../../includes/db_connect.php';
require_once __DIR__ . '/../../../includes/env.php';
require_once __DIR__ . '/../../../includes/trust_score_manager.php';

header('Content-Type: application/json');

// Admin Check (or Self-Check if authenticated user?)
// Typically "Trust Proof" is something a user requests to prove they are good, or admin requests for evidence.
// Let's assume Admin only for now, or User for their own data.
// For this hardening patch: Admin only.

$headers = getallheaders();
$adminSecret = getenv('ADMIN_SECRET_KEY');
if (!$adminSecret || ($headers['X-Admin-Secret'] ?? '') !== $adminSecret) {
    http_response_code(403);
    echo json_encode(['error' => 'FORBIDDEN']);
    exit;
}

$type = $_GET['type'] ?? 'USER';
$value = $_GET['value'] ?? null;

if (!$value) {
    http_response_code(400);
    echo json_encode(['error' => 'MISSING_PARAMS']);
    exit;
}

$manager = new TrustScoreManager($pdo);
$profile = $manager->getTrustProfile($type, $value);
$history = $manager->getRecentEvents($type, $value, 100); // Fetch deep history

$proof = [
    'timestamp' => date('c'),
    'actor' => "$type:$value",
    'score' => $profile['trust_score'],
    'level' => $profile['trust_level'],
    'history' => $history,
    'compliance_node' => getenv('NODE_ID') ?? 'PRIMARY'
];

$jsonParams = json_encode($proof, JSON_PRETTY_PRINT);

// Sign it
$keyDir = __DIR__ . '/../../../includes/keys';
if (!file_exists("$keyDir/private.pem")) {
    require_once "$keyDir/server_key_gen.php";
}
$privateKey = file_get_contents("$keyDir/private.pem");
openssl_sign($jsonParams, $signature, $privateKey, OPENSSL_ALGO_SHA256);

echo json_encode([
    'proof' => $proof,
    'signature' => base64_encode($signature)
]);
