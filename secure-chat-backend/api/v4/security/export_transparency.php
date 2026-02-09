<?php
// api/v4/security/export_transparency.php
// Epic 56: Export Signed Transparency Report

require_once __DIR__ . '/../../../includes/db_connect.php';
require_once __DIR__ . '/../../../includes/env.php';

// Public/Admin check
$headers = getallheaders();
$adminSecret = getenv('ADMIN_SECRET_KEY');
if (!$adminSecret || ($headers['X-Admin-Secret'] ?? '') !== $adminSecret) {
    http_response_code(403);
    exit('FORBIDDEN');
}

$id = $_GET['id'] ?? null;
if (!$id)
    exit('MISSING_ID');

$stmt = $pdo->prepare("SELECT * FROM transparency_reports WHERE report_id = ?");
$stmt->execute([$id]);
$report = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$report)
    exit('NOT_FOUND');

$filename = "transparency_report_{$report['period_start']}_{$report['period_end']}.json";

header('Content-Type: application/json');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('X-ChatFlect-Signature: ' . $report['signature']);

echo $report['report_json'];
