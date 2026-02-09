<?php
// api/v4/backup/status.php
// Epic 73: Check Job Status

require_once __DIR__ . '/../../includes/auth_middleware.php';
require_once __DIR__ . '/../../includes/db_connect.php';

$user = authenticate();
$jobId = $_GET['job_id'];

try {
    $stmt = $pdo->prepare("SELECT status, backup_size_bytes, created_at, expires_at FROM backup_jobs WHERE job_id = ? AND user_id = ?");
    $stmt->execute([$jobId, $user['user_id']]);
    $job = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$job) {
        http_response_code(404);
        echo json_encode(['error' => 'Job not found']);
        exit;
    }

    echo json_encode($job);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
