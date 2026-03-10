<?php
// serve.php - P26 FIX: Serve media files without auth headers
// Optimized with Range support, Caching, and Binary safety

$requestUid = uniqid('media_', true);
ini_set('display_errors', 0); // Ensure no text errors corrupt binary output
ob_start(); // Buffer output to prevent whitespace leakage from includes

// Phase 6: Robust CORS (Matches .htaccess for consistency)
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Range, Authorization, X-Requested-With");
header("Access-Control-Expose-Headers: Content-Length, Content-Range, ETag");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    exit;
}

// Get file path from query parameter
$filePath = $_GET['file'] ?? '';

if (empty($filePath)) {
    http_response_code(400);
    exit;
}

// Security: Prevent directory traversal and enforce uploads prefix
if (strpos($filePath, '..') !== false || strpos($filePath, "\0") !== false) {
    http_response_code(403);
    exit;
}

if (!str_starts_with($filePath, 'uploads/')) {
    http_response_code(403);
    exit;
}

// ---------------- SECURITY: RESOLVE PATH & VET ACCESSIBILITY ----------------
$baseDir = realpath(__DIR__);
$fileParam = ltrim($filePath, '/'); // Remove leading slash for safety
$fullPath = $baseDir . DIRECTORY_SEPARATOR . $fileParam;

if (!file_exists($fullPath) || !is_file($fullPath)) {
    http_response_code(404);
    exit;
}

// ---------------- PHASE 6: SIGNED URL VERIFICATION (NO COOKIES) ----------------
require_once __DIR__ . '/../includes/secrets_manager.php';
require_once __DIR__ . '/db.php'; // Required by CacheService for $conn
require_once __DIR__ . '/cache_service.php';

$secret = SecretsManager::get('MEDIA_SECRET', 'snapflect_fallback_secret');
$expiry = $_GET['exp'] ?? 0;
$signature = $_GET['sig'] ?? '';

if ($expiry < time()) {
    http_response_code(403);
    exit("Signature expired");
}

// Ensure leading slash is removed BEFORE signature check to match generator
$sigFile = ltrim($filePath, '/');
$expectedSig = hash_hmac('sha256', $expiry . $sigFile, $secret);

if (!hash_equals($expectedSig, $signature)) {
    http_response_code(403);
    exit("Invalid signature");
}

// ---------------- CACHING & ETAG ----------------
$mtime = filemtime($fullPath);
$fsize = filesize($fullPath);
$cacheKeyV8 = "etag_v8:" . $sigFile . ":" . $mtime . ":" . $fsize;

$etag = CacheService::get($cacheKeyV8);

if (!$etag) {
    $etag = hash_file('sha256', $fullPath);
    CacheService::set($cacheKeyV8, $etag, 86400 * 30, ['uid' => $requestUid, 'strat' => 'SHA256']);
}

header("ETag: \"$etag\"");
header("Last-Modified: " . gmdate("D, d M Y H:i:s", $mtime) . " GMT");

// Check for conditional request
$ifNoneMatch = isset($_SERVER['HTTP_IF_NONE_MATCH']) ? trim($_SERVER['HTTP_IF_NONE_MATCH'], '"') : null;
if ($ifNoneMatch === $etag) {
    http_response_code(304);
    exit;
}

// Get MIME type
$ext = strtolower(pathinfo($fullPath, PATHINFO_EXTENSION));
$extMimeMap = [
    'jpg' => 'image/jpeg',
    'jpeg' => 'image/jpeg',
    'png' => 'image/png',
    'gif' => 'image/gif',
    'webp' => 'image/webp',
    'mp4' => 'video/mp4',
    'mp3' => 'audio/mpeg',
    'ogg' => 'audio/ogg',
    'pdf' => 'application/pdf'
];
$mimeType = $extMimeMap[$ext] ?? 'application/octet-stream';

header("Content-Type: " . $mimeType);
header("Cache-Control: public, max-age=31536000, immutable");
header("Accept-Ranges: bytes");

// Range handling for streaming (Required for Video Seeking)
$start = 0;
$length = $fsize;

if (isset($_SERVER['HTTP_RANGE'])) {
    if (preg_match('/bytes=(\d+)-(\d*)/', $_SERVER['HTTP_RANGE'], $matches)) {
        $start = intval($matches[1]);
        $end = !empty($matches[2]) ? intval($matches[2]) : $fsize - 1;

        if ($start >= $fsize || $end >= $fsize) {
            http_response_code(416);
            header("Content-Range: bytes */$fsize");
            exit;
        }

        $length = $end - $start + 1;
        http_response_code(206);
        header("Content-Range: bytes $start-$end/$fsize");
    }
}

header("Content-Length: $length");

// Phase 6 FIX: Clear buffer to prevent binary corruption from accidental whitespace/warnings
while (ob_get_level() > 0) {
    ob_end_clean();
}

$fp = fopen($fullPath, 'rb');
fseek($fp, $start);
$bytesRemaining = $length;
$bufferSize = 8192;

while (!feof($fp) && $bytesRemaining > 0) {
    $read = min($bufferSize, $bytesRemaining);
    echo fread($fp, $read);
    flush();
    $bytesRemaining -= $read;
}
fclose($fp);
