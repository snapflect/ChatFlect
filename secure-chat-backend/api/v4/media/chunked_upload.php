<?php
// api/v4/media/chunked_upload.php
// Phase 5E: Chunked Uploads + Resume + Retry
// Standardized contract with upload.php

require_once __DIR__ . '/../../../api/auth_middleware.php';

$user = requireAuth();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$action = $_GET['action'] ?? 'chunk'; // init, chunk, finalize

$uploadDir = __DIR__ . '/../../../api/uploads/';
$tempDir = $uploadDir . 'temp/';
if (!is_dir($tempDir)) {
    mkdir($tempDir, 0755, true);
}

try {
    switch ($action) {
        case 'init':
            handleInit($user, $input, $pdo);
            break;
        case 'chunk':
            handleChunk($user, $pdo, $tempDir);
            break;
        case 'finalize':
            handleFinalize($user, $input, $pdo, $tempDir, $uploadDir);
            break;
        default:
            throw new Exception("Invalid action: $action");
    }
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}

function handleInit($user, $input, $pdo)
{
    $uploadId = $input['upload_id'] ?? bin2hex(random_bytes(16));
    $filename = $input['filename'] ?? 'upload.bin';
    $totalSize = $input['total_size'] ?? 0;
    $chunkCount = $input['chunk_count'] ?? 0;
    $hash = $input['sha256_hash'] ?? null;

    if (!$totalSize || !$chunkCount) {
        throw new Exception("Missing total_size or chunk_count");
    }

    $stmt = $pdo->prepare("INSERT INTO upload_sessions (upload_id, user_id, filename, total_size, chunk_count, sha256_hash, status) 
                           VALUES (?, ?, ?, ?, ?, ?, 'active') 
                           ON DUPLICATE KEY UPDATE updated_at = NOW()");
    $stmt->execute([$uploadId, $user['user_id'], $filename, $totalSize, $chunkCount, $hash]);

    echo json_encode(['success' => true, 'upload_id' => $uploadId]);
}

function handleChunk($user, $pdo, $tempDir)
{
    $uploadId = $_POST['upload_id'] ?? null;
    $chunkIndex = isset($_POST['chunk_index']) ? (int) $_POST['chunk_index'] : null;

    if (!$uploadId || $chunkIndex === null || !isset($_FILES['file'])) {
        throw new Exception("Missing upload_id, chunk_index, or file");
    }

    // Verify session
    $stmt = $pdo->prepare("SELECT user_id, status, chunk_count FROM upload_sessions WHERE upload_id = ?");
    $stmt->execute([$uploadId]);
    $session = $stmt->fetch();

    if (!$session || $session['user_id'] !== $user['user_id']) {
        throw new Exception("Invalid or unauthorized upload session");
    }
    if ($session['status'] !== 'active') {
        throw new Exception("Upload session is no longer active");
    }

    $chunkFile = $tempDir . $uploadId . '_' . $chunkIndex . '.part';
    if (!move_uploaded_file($_FILES['file']['tmp_name'], $chunkFile)) {
        throw new Exception("Failed to save chunk");
    }

    // Update progress
    $stmtUpdate = $pdo->prepare("UPDATE upload_sessions SET last_chunk_index = GREATEST(last_chunk_index, ?) WHERE upload_id = ?");
    $stmtUpdate->execute([$chunkIndex, $uploadId]);

    echo json_encode(['success' => true, 'received' => $chunkIndex]);
}

function handleFinalize($user, $input, $pdo, $tempDir, $uploadDir)
{
    $uploadId = $input['upload_id'] ?? null;
    if (!$uploadId)
        throw new Exception("Missing upload_id");

    $stmt = $pdo->prepare("SELECT * FROM upload_sessions WHERE upload_id = ?");
    $stmt->execute([$uploadId]);
    $session = $stmt->fetch();

    if (!$session || $session['user_id'] !== $user['user_id']) {
        throw new Exception("Invalid or unauthorized upload session");
    }

    $ext = pathinfo($session['filename'], PATHINFO_EXTENSION);
    if (empty($ext))
        $ext = 'bin';
    $finalFilename = uniqid('med_', true) . '.' . $ext;
    $finalPath = $uploadDir . $finalFilename;

    $out = fopen($finalPath, "wb");
    for ($i = 0; $i < $session['chunk_count']; $i++) {
        $chunkPath = $tempDir . $uploadId . '_' . $i . '.part';
        if (!file_exists($chunkPath)) {
            fclose($out);
            unlink($finalPath);
            throw new Exception("Missing chunk: $i");
        }
        $in = fopen($chunkPath, "rb");
        stream_copy_to_stream($in, $out);
        fclose($in);
        unlink($chunkPath);
    }
    fclose($out);

    // TODO: Verify Hash if provided

    $stmtUpdate = $pdo->prepare("UPDATE upload_sessions SET status = 'completed' WHERE upload_id = ?");
    $stmtUpdate->execute([$uploadId]);

    // Same contract as upload.php
    $baseUrl = getBaseUrl();
    echo json_encode([
        "status" => "success",
        "url" => $baseUrl . '/serve.php?file=' . urlencode('uploads/' . $finalFilename),
        "serve_url" => $baseUrl . '/serve.php?file=' . urlencode('uploads/' . $finalFilename),
        "filename" => $finalFilename,
        "encrypted" => ($ext === 'bin')
    ]);
}

function getBaseUrl(): string
{
    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    return $protocol . '://' . $_SERVER['HTTP_HOST'] . str_replace('api/v4/media/chunked_upload.php', 'api', $_SERVER['SCRIPT_NAME']);
}
