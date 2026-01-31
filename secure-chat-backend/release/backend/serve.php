<?php
// serve.php - P26 FIX: Serve media files without auth headers
// This endpoint allows <img> tags to load images directly without Authorization headers


ini_set('display_errors', 0); // Ensure no text errors corrupt binary output
// Headers handled by .htaccess/server config to prevent duplicates
// header("Access-Control-Allow-Origin: *");
// header("Access-Control-Allow-Methods: GET, OPTIONS");
// header("Access-Control-Allow-Headers: Content-Type, Range, Authorization, X-User-ID");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo "Method not allowed";
    exit;
}

// Get file path from query parameter
$filePath = $_GET['file'] ?? '';

if (empty($filePath)) {
    http_response_code(400);
    echo "Missing file parameter";
    exit;
}

// Security: Prevent directory traversal
$filePath = str_replace(['..', "\0"], '', $filePath);

// Resolve to absolute path within API directory
$baseDir = __DIR__;
$fullPath = realpath($baseDir . '/' . $filePath);

// Security check: Ensure file is within allowed directory
if ($fullPath === false || strpos($fullPath, realpath($baseDir)) !== 0) {
    http_response_code(403);
    echo "Access denied";
    exit;
}

// Check file exists
if (!file_exists($fullPath) || !is_file($fullPath)) {
    http_response_code(404);
    echo "File not found";
    exit;
}

// ---------- PRODUCTION-GRADE ETAG OPTIMIZATION (v8 Definitive) ----------
require_once 'db.php';
require_once 'cache_service.php';
require_once 'audit_log.php';

// forensic correlation
$requestUid = uniqid('req_', true);
$sessionId = session_id() ?: 'no-session';
$accessUserId = $_GET['uid'] ?? $_SERVER['HTTP_X_USER_ID'] ?? null;

// v12: Structured audit log for media access (3.4 compliance)
auditLog('media_accessed', $accessUserId, [
    'file' => $filePath,
    'request_uid' => $requestUid,
    'session' => $sessionId
]);

error_log("[SERVE][v8][START] UID: $requestUid | Session: $sessionId | File: $filePath");

$mtime = filemtime($fullPath);
$fsize = filesize($fullPath);
$cacheKeyV8 = "etag_v8:" . $filePath . ":" . $mtime . ":" . $fsize;

$etag = CacheService::get($cacheKeyV8);

if (!$etag) {
    // Upgraded to SHA-256 for definitive security compliance (v8)
    $etag = hash_file('sha256', $fullPath);

    // Audit Trace: Delineate if this was a fresh generation or a migration (v8)
    $isMigration = false;
    $legacyKeys = [
        "etag:" . $filePath . ":" . $mtime . ":" . $fsize,
        "etag_v5:" . $filePath . ":" . $mtime . ":" . $fsize,
        "etag_v7:" . $filePath . ":" . $mtime . ":" . $fsize,
        "etag_legacy:" . $filePath . ":" . $mtime . ":" . $fsize,
        "etag_legacy_v7:" . $filePath . ":" . $mtime . ":" . $fsize
    ];

    foreach ($legacyKeys as $lKey) {
        if (CacheService::get($lKey)) {
            $isMigration = true;
            CacheService::delete($lKey);
        }
    }

    // Persist with Forensic Metadata (v8)
    CacheService::set($cacheKeyV8, $etag, 86400 * 30, ['uid' => $requestUid, 'strat' => 'SHA256']);

    $logLabel = $isMigration ? "MIGRATION_MD5_SHA256" : "STANDARD_SHA256";
    error_log("[SERVE][v8][$logLabel] UID: $requestUid | File: $filePath");
}

header("ETag: \"$etag\"");
header("Last-Modified: " . gmdate("D, d M Y H:i:s", $mtime) . " GMT");

// Check for conditional request
$ifNoneMatch = isset($_SERVER['HTTP_IF_NONE_MATCH']) ? trim($_SERVER['HTTP_IF_NONE_MATCH'], '"') : null;

if ($ifNoneMatch) {
    // 1. Check primary SHA-256 match
    if ($ifNoneMatch === $etag) {
        error_log("[SERVE][v8][MATCH_SHA256] UID: $requestUid | File: $filePath");
        http_response_code(304);
        exit;
    }

    // 2. Legacy Compatibility (v8): Support transition from MD5
    if (strlen($ifNoneMatch) === 32) {
        $legacyKey = "etag_legacy_v8:" . $filePath . ":" . $mtime . ":" . $fsize;
        $legacyEtag = CacheService::get($legacyKey);
        if (!$legacyEtag) {
            $legacyEtag = md5_file($fullPath);
            CacheService::set($legacyKey, $legacyEtag, 86400 * 7, ['uid' => $requestUid, 'strat' => 'MD5_LEGACY']);
        }
        if ($ifNoneMatch === $legacyEtag) {
            error_log("[SERVE][v8][MATCH_MD5_LEGACY] UID: $requestUid | File: $filePath");
            http_response_code(304);
            exit;
        }
    }
    error_log("[SERVE][v8][MISMATCH] UID: $requestUid | File: $filePath | Target: " . substr($etag, 0, 8) . "... | Provided: " . substr($ifNoneMatch, 0, 8) . "...");
}

// Get MIME type
$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mimeType = finfo_file($finfo, $fullPath);
finfo_close($finfo);

// Map common extensions for better browser compatibility
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

if (isset($extMimeMap[$ext])) {
    $mimeType = $extMimeMap[$ext];
}

// Set headers for proper browser rendering
header("Content-Type: " . $mimeType);
header("Content-Length: " . $fsize);
header("Cache-Control: public, max-age=31536000"); // Cache for 1 year
header("Accept-Ranges: bytes");

// Handle range requests for video/audio streaming
if (isset($_SERVER['HTTP_RANGE'])) {
    $range = $_SERVER['HTTP_RANGE'];

    if (preg_match('/bytes=(\d+)-(\d*)/', $range, $matches)) {
        $start = intval($matches[1]);
        $end = !empty($matches[2]) ? intval($matches[2]) : $fsize - 1;

        if ($start >= $fsize || $end >= $fsize) {
            http_response_code(416); // Range Not Satisfiable
            header("Content-Range: bytes */$fsize");
            exit;
        }

        $length = $end - $start + 1;

        http_response_code(206); // Partial Content
        header("Content-Range: bytes $start-$end/$fsize");
        header("Content-Length: $length");

        $fp = fopen($fullPath, 'rb');
        fseek($fp, $start);
        echo fread($fp, $length);
        fclose($fp);
        exit;
    }
}

// Output the file
readfile($fullPath);
