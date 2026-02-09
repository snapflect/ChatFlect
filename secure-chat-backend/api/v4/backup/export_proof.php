<?php
// api/v4/backup/export_proof.php
// Epic 73 HF: Backup Existence Proof

require_once __DIR__ . '/../../includes/auth_middleware.php';
require_once __DIR__ . '/../../includes/db_connect.php';

$user = authenticate();

try {
    $stmt = $pdo->prepare("
        SELECT bj.job_id, bj.created_at, bb.signature, bb.schema_version 
        FROM backup_jobs bj
        JOIN backup_blobs bb ON bj.job_id = bb.job_id
        WHERE bj.user_id = ? AND bj.status = 'COMPLETED'
        ORDER BY bj.created_at DESC LIMIT 1
    ");
    $stmt->execute([$user['user_id']]);
    $proof = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$proof) {
        http_response_code(404);
        echo json_encode(['error' => 'No backups found']);
        exit;
    }

    echo json_encode(['proof' => $proof]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
