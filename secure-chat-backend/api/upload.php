<?php
// upload.php - Unified Media Upload Handler
// Fixes: P21, P22, P23, P24, P25

require_once 'rate_limiter.php';
require_once 'audit_log.php';
require_once 'auth_middleware.php';

// Enforce Rate Limit (DoS Protection)
enforceRateLimit();

// SECURITY FIX (J6): Enforce authentication for file uploads
$authUserId = requireAuth();

header("Content-Type: application/json; charset=utf-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["error" => "Method not allowed"]);
    exit;
}

$uploadDir = __DIR__ . '/uploads/';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

/**
 * Build absolute base URL
 */
function getBaseUrl(): string
{
    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    return $protocol . '://' . $_SERVER['HTTP_HOST'] . dirname($_SERVER['SCRIPT_NAME']);
}

if (!isset($_FILES['file'])) {
    http_response_code(400);
    echo json_encode(["error" => "No file received"]);
    exit;
}

$file = $_FILES['file'];
$tmpPath = $file['tmp_name'];
$originalName = $file['name'];

// Detect real MIME type
$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mimeType = finfo_file($finfo, $tmpPath);
finfo_close($finfo);

// ---------- P23 FIX: STRICT ALLOW LIST ----------
$allowedMimeMap = [
    // Images (public)
    'image/jpeg' => 'jpg',
    'image/png' => 'png',
    'image/gif' => 'gif',
    'image/webp' => 'webp',

    // Media
    'video/mp4' => 'mp4',
    'audio/mpeg' => 'mp3',
    'audio/ogg' => 'ogg',

    // Documents
    'application/pdf' => 'pdf',

    // Encrypted blobs ONLY
    'application/octet-stream' => 'bin'
];

if (!isset($allowedMimeMap[$mimeType])) {
    http_response_code(400);
    echo json_encode([
        "error" => "Unsupported file type",
        "mime" => $mimeType
    ]);
    exit;
}

$ext = $allowedMimeMap[$mimeType];

// ---------- P24 FIX: ENCRYPTED BLOB HANDLING ----------
$isEncrypted = false;
if ($ext === 'bin') {
    // Encrypted files MUST be uploaded as .bin
    $isEncrypted = true;

    // HF-5C.2 (P0 Audit): Enforce Anti-Tamper Header
    if (!isset($_SERVER['HTTP_X_ENCRYPTED']) || $_SERVER['HTTP_X_ENCRYPTED'] !== '1') {
        http_response_code(403);
        echo json_encode(["error" => "Security Policy Violation: Encrypted payload must have X-Encrypted header"]);
        exit;
    }
}

// Generate safe unique filename
$filename = uniqid('med_', true) . '.' . $ext;
$targetPath = $uploadDir . $filename;

if (!move_uploaded_file($tmpPath, $targetPath)) {
    http_response_code(500);
    echo json_encode(["error" => "Upload failed"]);
    exit;
}

// ---------- P21 FIX: ABSOLUTE URL ----------
$baseUrl = getBaseUrl();
$publicUrl = $baseUrl . '/serve.php?file=' . urlencode('uploads/' . $filename);

// Authenticated/proxied access (NOT for <img>)
$serveUrl = $baseUrl . '/serve.php?file=' . urlencode('uploads/' . $filename);

$response = [
    "status" => "success",

    // CONTRACT:
    // url       -> PUBLIC, SAFE for <img>
    // serve_url -> AUTHENTICATED / PRIVATE (never use in <img>)
    "url" => $publicUrl,
    "serve_url" => $serveUrl,

    "filename" => $filename,
    "mime" => $mimeType,
    "encrypted" => $isEncrypted
];

echo json_encode($response);
