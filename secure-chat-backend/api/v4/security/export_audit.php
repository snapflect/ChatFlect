<?php
// api/v4/security/export_audit.php
// Epic 53: Export Audit Logs (JSON/CSV)

require_once __DIR__ . '/../../../includes/db_connect.php';
require_once __DIR__ . '/../../../includes/env.php';
require_once __DIR__ . '/../../../includes/csv_writer.php';

// HF-51.6: Export Signing
// Prepare keys
$keyDir = __DIR__ . '/../../../includes/keys';
if (!file_exists("$keyDir/private.pem")) {
    require_once "$keyDir/server_key_gen.php";
}
$privateKey = file_get_contents("$keyDir/private.pem");

// Buffer Output for Signing (Note: For huge exports, streaming + chunk signing is better, 
// strictly limiting buffer here for safety as per HF-53.3 caps)
ob_start();

// Admin Auth
$headers = getallheaders();
$adminSecret = getenv('ADMIN_SECRET_KEY');

if (!$adminSecret || ($headers['X-Admin-Secret'] ?? '') !== $adminSecret) {
    http_response_code(403);
    exit('FORBIDDEN');
}

$format = $_GET['format'] ?? 'json';
$limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 1000;

// Streaming Query
$stmt = $pdo->prepare("SELECT * FROM security_audit_log ORDER BY created_at DESC LIMIT ?");
$stmt->execute([$limit]);

if ($format === 'csv') {
    header('Content-Type: text/csv');
    header('Content-Disposition: attachment; filename="audit_export.csv"');

    $writer = new CsvWriter();
    $writer->writeHeader(['audit_id', 'event_type', 'severity', 'user_id', 'device_id', 'ip_address', 'meta', 'created_at']);

// End buffering and sign
$data = ob_get_clean();

// Compute Signature
$signature = '';
openssl_sign($data, $signature, $privateKey, OPENSSL_ALGO_SHA256);
$base64Sig = base64_encode($signature);

// Send Headers
header("X-ChatFlect-Signature: $base64Sig");
echo $data;

