<?php
// api/v4/security/report_actor.php
// Epic 53: Actor Risk Report (Single Page View)

require_once __DIR__ . '/../../../includes/db_connect.php';
require_once __DIR__ . '/../../../includes/env.php';

header('Content-Type: application/json');

// Admin Auth
$headers = getallheaders();
$adminSecret = getenv('ADMIN_SECRET_KEY');
if (!$adminSecret || ($headers['X-Admin-Secret'] ?? '') !== $adminSecret) {
    http_response_code(403);
    echo json_encode(['error' => 'FORBIDDEN']);
    exit;
}

$targetType = $_GET['type'] ?? 'IP';
$value = $_GET['value'] ?? null;

if (!$value) {
    http_response_code(400);
    echo json_encode(['error' => 'MISSING_VALUE']);
    exit;
}

// Risk Calculation
$riskScore = 0;
$riskFactors = [];

// 1. Check Abuse Score
$targetKey = md5("$targetType:$value");
$stmt = $pdo->prepare("SELECT score FROM abuse_scores WHERE target_key = ?");
$stmt->execute([$targetKey]);
$abuseScore = (int) $stmt->fetchColumn();

if ($abuseScore > 0) {
    $riskScore += $abuseScore;
    $riskFactors[] = "Abuse Score: $abuseScore";
}

// 2. Check Ban History
$stmtBans = $pdo->prepare("SELECT COUNT(*) FROM ip_banlist WHERE target_type = ? AND target_value = ?");
$stmtBans->execute([$targetType, $value]);
$banCount = (int) $stmtBans->fetchColumn();

if ($banCount > 0) {
    $riskScore += ($banCount * 20);
    $riskFactors[] = "Prior Bans: $banCount";
}

// 3. Recommendation
$recommendation = 'IGNORE';
if ($riskScore > 100)
    $recommendation = 'BAN_IMMEDIATELY';
elseif ($riskScore > 50)
    $recommendation = 'WATCH';

echo json_encode([
    'actor' => $value,
    'risk_score' => $riskScore,
    'factors' => $riskFactors,
    'recommendation' => $recommendation
]);
