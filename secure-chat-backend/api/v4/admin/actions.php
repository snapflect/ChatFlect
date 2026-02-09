<?php
// api/v4/admin/actions.php
// Epic 58: List pending actions

require_once __DIR__ . '/../../../includes/db_connect.php';
require_once __DIR__ . '/../../../includes/env.php';

header('Content-Type: application/json');
if ((getallheaders()['X-Admin-Secret'] ?? '') !== getenv('ADMIN_SECRET_KEY')) {
    http_response_code(403);
    exit;
}

$status = $_GET['status'] ?? 'PENDING';
$stmt = $pdo->prepare("SELECT * FROM admin_action_queue WHERE status = ? ORDER BY created_at ASC");
$stmt->execute([$status]);
echo json_encode(['success' => true, 'actions' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
