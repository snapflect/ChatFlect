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

$filename = "transparency_report_{$report['period_start']}_{$report['period_end']}";
$tmpFile = tempnam(sys_get_temp_dir(), 'TRZIP');
$zip = new ZipArchive();
if ($zip->open($tmpFile, ZipArchive::CREATE) !== TRUE) {
    exit('ZIP_ERROR');
}

// 1. Report JSON
$zip->addFromString('report.json', $report['report_json']);

// 2. Signature
$zip->addFromString('signature.sig', base64_decode($report['signature']));

// 3. Manifest
$manifest = [
    'period' => $report['period_start'] . ' to ' . $report['period_end'],
    'integrity_hash' => $report['integrity_hash'],
    'generated_at' => $report['generated_at'],
    'schema_version' => json_decode($report['report_json'])->header->schema_version ?? '1.0'
];
$zip->addFromString('manifest.json', json_encode($manifest, JSON_PRETTY_PRINT));

$zip->close();

header('Content-Type: application/zip');
header('Content-Disposition: attachment; filename="' . $filename . '.zip"');
header('Content-Length: ' . filesize($tmpFile));
readfile($tmpFile);
unlink($tmpFile);
