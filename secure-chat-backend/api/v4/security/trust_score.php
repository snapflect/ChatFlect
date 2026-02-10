<?php
// api/v4/security/trust_score.php
// Epic 55: Trust Score Admin API
// View Trust Score and History for an actor

require_once __DIR__ . '/../../../includes/db_connect.php';
require_once __DIR__ . '/../../../includes/env.php';
require_once __DIR__ . '/../../../includes/trust_score_manager.php';

header('Content-Type: application/json');

// Admin Auth
$headers = getallheaders();
$adminSecret = getenv('ADMIN_SECRET_KEY');
if (!$adminSecret || ($headers['X-Admin-Secret'] ?? '') !== $adminSecret) {
    http_response_code(403);
    echo json_encode(['error' => 'FORBIDDEN']);
    exit;
}

$type = $_GET['type'] ?? 'IP';
$value = $_GET['value'] ?? null;

if (!$value) {
    http_response_code(400);
    echo json_encode(['error' => 'MISSING_PARAMS']);
    exit;
}

$manager = new TrustScoreManager($pdo);
$profile = $manager->getTrustProfile($type, $value);
$history = $manager->getRecentEvents($type, $value);

echo json_encode([
    'success' => true,
    'actor' => "$type:$value",
    'profile' => $profile,
    'history' => $history
]);
