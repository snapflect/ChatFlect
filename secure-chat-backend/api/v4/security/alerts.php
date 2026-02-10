<?php
// api/v4/security/alerts.php
// Epic 26: Security Alerts - Fetch Alerts

require_once __DIR__ . '/../../../includes/db_connect.php';
require_once __DIR__ . '/../../auth_middleware.php';
require_once __DIR__ . '/../../../includes/security_alerts.php';

header('Content-Type: application/json');

try {
    // 1. Authenticate
    $auth = authenticate_request($pdo);
    $user_id = $auth['user_id'];

    // 2. Parse Parameters
    $sinceId = isset($_GET['since_id']) ? (int) $_GET['since_id'] : null;
    $limit = isset($_GET['limit']) ? min((int) $_GET['limit'], 100) : 50;
    $unreadOnly = isset($_GET['unread']) && $_GET['unread'] === '1';

    // 3. Fetch Alerts
    $alerts = fetchAlerts($pdo, $user_id, $sinceId, $limit, $unreadOnly);
    $unreadCount = getUnreadAlertCount($pdo, $user_id);

    echo json_encode([
        'success' => true,
        'alerts' => $alerts,
        'count' => count($alerts),
        'unread_count' => $unreadCount
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'SERVER_ERROR']);
}
