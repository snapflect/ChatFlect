<?php
// api/v4/public/trust/public_key.php
// HF-56.6: Public Key Publishing Endpoint
// Exposes the server's RSA Public Key for independent verification of signatures.
// HF-56.7: Adds CDN Caching (ETag, Cache-Control).

require_once __DIR__ . '/../../../../includes/env.php';

// 1. Load Key
$keyDir = __DIR__ . '/../../../../includes/keys';
$pubKeyArgs = "$keyDir/public.pem";

if (!file_exists($pubKeyArgs)) {
    http_response_code(404);
    echo "Public Key Not Available";
    exit;
}

$content = file_get_contents($pubKeyArgs);
$hash = md5($content);

// 2. Caching Headers (HF-56.7)
// Public key rarely changes. Cache for 1 hour.
header('Cache-Control: public, max-age=3600');
header('ETag: "' . $hash . '"');

// Check ETag
if (isset($_SERVER['HTTP_IF_NONE_MATCH']) && trim($_SERVER['HTTP_IF_NONE_MATCH']) === '"' . $hash . '"') {
    http_response_code(304);
    exit;
}

// 3. Output
header('Content-Type: text/plain');
header('Content-Length: ' . strlen($content));
echo $content;
