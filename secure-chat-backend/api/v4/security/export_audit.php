<?php
// api/v4/security/export_audit.php
// Epic 53: Export Audit Logs (JSON/CSV)

require_once __DIR__ . '/../../../includes/db_connect.php';
require_once __DIR__ . '/../../../includes/env.php';
require_once __DIR__ . '/../../../includes/csv_writer.php';

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

    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $writer->writeRow($row);
    }
    $writer->close();
} else {
    header('Content-Type: application/json');
    echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
}
