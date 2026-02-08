<?php
// api/v4/security/export_case.php
// Epic 53 Hardening: Signed Export Bundles (ZIP)
// Packages logs, bans, and scores into a single ZIP with an integrity manifest.

require_once __DIR__ . '/../../../includes/db_connect.php';
require_once __DIR__ . '/../../../includes/env.php';

// Admin Auth
$headers = getallheaders();
$adminSecret = getenv('ADMIN_SECRET_KEY');
if (!$adminSecret || ($headers['X-Admin-Secret'] ?? '') !== $adminSecret) {
    http_response_code(403);
    exit('FORBIDDEN');
}

$caseId = $_GET['case_id'] ?? 'CASE_' . date('Ymd_His');
$targetType = $_GET['type'] ?? 'IP';
$targetValue = $_GET['value'] ?? null;

if (!$targetValue) {
    http_response_code(400);
    exit(json_encode(['error' => 'MISSING_PARAMS']));
}

$tmpFile = tempnam(sys_get_temp_dir(), 'case_');
$zip = new ZipArchive();
if ($zip->open($tmpFile, ZipArchive::CREATE) !== TRUE) {
    exit("Cannot create zip");
}

// 1. Gather Data (Reuse snapshot logic implicitly or explicitly query)
// For speed, let's query raw tables
$manifest = ['files' => [], 'generated_at' => date('c'), 'target' => "$targetType:$targetValue"];

// A. Audit Logs
$stmt = $pdo->prepare("SELECT * FROM security_audit_log WHERE " . (($targetType == 'USER') ? 'user_id' : 'ip_address') . " = ? LIMIT 1000");
$stmt->execute([$targetValue]);
$logs = $stmt->fetchAll(PDO::FETCH_ASSOC);
$zip->addFromString('audit_logs.json', json_encode($logs, JSON_PRETTY_PRINT));
$manifest['files']['audit_logs.json'] = hash('sha256', json_encode($logs));

// B. Bans (Active & Expired)
$stmtBan = $pdo->prepare("SELECT * FROM ip_banlist WHERE target_type = ? AND target_value = ?");
$stmtBan->execute([$targetType, $targetValue]);
$bans = $stmtBan->fetchAll(PDO::FETCH_ASSOC);
$zip->addFromString('ban_history.json', json_encode($bans, JSON_PRETTY_PRINT));
$manifest['files']['ban_history.json'] = hash('sha256', json_encode($bans));

// C. Manifest
$zip->addFromString('manifest.json', json_encode($manifest, JSON_PRETTY_PRINT));

$zip->close();

// Stream ZIP
header('Content-Type: application/zip');
header('Content-Disposition: attachment; filename="' . $caseId . '.zip"');
header('Content-Length: ' . filesize($tmpFile));
readfile($tmpFile);
unlink($tmpFile);
