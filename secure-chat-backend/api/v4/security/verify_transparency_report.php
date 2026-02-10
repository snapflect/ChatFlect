<?php
// api/v4/security/verify_transparency_report.php
// HF-56.2: Report Verification Endpoint
// Accepts a transparency report JSON and verifies its integrity against the server's public key.

require_once __DIR__ . '/../../../includes/env.php';

header('Content-Type: application/json');

// Public Endpoint (No Auth Required)
// Purpose: "Trust but Verify"

$input = file_get_contents('php://input');
$data = json_decode($input, true);

if (!$data || !isset($data['report_json']) || !isset($data['signature'])) {
    http_response_code(400);
    echo json_encode(['error' => 'INVALID_PAYLOAD']);
    exit;
}

$reportJson = $data['report_json']; // The inner JSON string
$signature = base64_decode($data['signature']);
$hash = hash('sha256', $reportJson);

// Verify
$keyDir = __DIR__ . '/../../../includes/keys';
if (!file_exists("$keyDir/public.pem")) {
    // If we only have private, we can derive public, but usually public is published.
    // Shim for dev env if missing
    http_response_code(500);
    echo json_encode(['error' => 'PUBLIC_KEY_MISSING']);
    exit;
}
$publicKey = file_get_contents("$keyDir/public.pem");

$result = openssl_verify($hash, $signature, $publicKey, OPENSSL_ALGO_SHA256);

if ($result === 1) {
    echo json_encode([
        'success' => true,
        'verified' => true,
        'integrity_hash' => $hash,
        'message' => 'Signature is valid. Report is authentic.'
    ]);
} elseif ($result === 0) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'verified' => false,
        'error' => 'SIGNATURE_MISMATCH'
    ]);
} else {
    http_response_code(500);
    echo json_encode(['error' => 'VERIFICATION_ERROR', 'openssl' => openssl_error_string()]);
}
