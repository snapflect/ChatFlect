<?php
// api/v4/security/alerts_read.php
// Epic 26: Security Alerts - Mark Alert Read

require_once __DIR__ . '/../../../includes/db_connect.php';
require_once __DIR__ . '/../../auth_middleware.php';
require_once __DIR__ . '/../../../includes/security_alerts.php';

header('Content-Type: application/json');

try {
    // 1. Authenticate
    $auth = authenticate_request($pdo);
    $user_id = $auth['user_id'];

    // 2. Parse Input
    $input = json_decode(file_get_contents('php://input'), true);
    $alertId = $input['alert_id'] ?? null;

    if (!$alertId) {
        http_response_code(400);
        echo json_encode(['error' => 'MISSING_ALERT_ID']);
        exit;
    }

    // 3. Mark Read (only allows marking own alerts)
    $success = markAlertRead($pdo, $user_id, $alertId);

    if (!$success) {
        http_response_code(404);
        echo json_encode(['error' => 'ALERT_NOT_FOUND']);
        exit;
    }

    echo json_encode([
        'success' => true,
        'alert_id' => $alertId
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'SERVER_ERROR']);
}
