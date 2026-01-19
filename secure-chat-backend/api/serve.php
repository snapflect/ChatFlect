<?php
// serve.php - P26 FIX: Serve media files without auth headers
// This endpoint allows <img> tags to load images directly without Authorization headers

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Range, Authorization, X-User-ID");

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
header("Content-Length: " . filesize($fullPath));
header("Cache-Control: public, max-age=31536000"); // Cache for 1 year
header("Accept-Ranges: bytes");

// Handle range requests for video/audio streaming
if (isset($_SERVER['HTTP_RANGE'])) {
    $fileSize = filesize($fullPath);
    $range = $_SERVER['HTTP_RANGE'];

    if (preg_match('/bytes=(\d+)-(\d*)/', $range, $matches)) {
        $start = intval($matches[1]);
        $end = !empty($matches[2]) ? intval($matches[2]) : $fileSize - 1;

        if ($start >= $fileSize || $end >= $fileSize) {
            http_response_code(416); // Range Not Satisfiable
            header("Content-Range: bytes */$fileSize");
            exit;
        }

        $length = $end - $start + 1;

        http_response_code(206); // Partial Content
        header("Content-Range: bytes $start-$end/$fileSize");
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
?>