<?php
// api/admin/v1/user_detail.php
// Epic 27: Admin Dashboard - User Full Details

require_once __DIR__ . '/../../../includes/admin_auth.php';

header('Content-Type: application/json');

try {
    $adminId = requireAdminAuth();
    $pdo = getAdminPdo();

    $userId = $_GET['user_id'] ?? null;
    if (!$userId) {
        http_response_code(400);
        echo json_encode(['error' => 'MISSING_USER_ID']);
        exit;
    }

    // Log admin view action
    logAdminAction($pdo, $adminId, $userId, 'VIEW_USER', null);

    // 1. Abuse Score
    $stmt = $pdo->prepare("SELECT score, risk_level, cooldown_until, last_updated FROM abuse_scores WHERE user_id = ?");
    $stmt->execute([$userId]);
    $abuseScore = $stmt->fetch() ?: ['score' => 0, 'risk_level' => 'LOW', 'cooldown_until' => null];

    // 2. Devices
    $stmt = $pdo->prepare("SELECT device_uuid, device_name, platform, status, registered_at FROM user_devices WHERE user_id = ? ORDER BY registered_at DESC");
    $stmt->execute([$userId]);
    $devices = $stmt->fetchAll();

    // 3. Security Alerts (last 20)
    $stmt = $pdo->prepare("SELECT id, alert_type, severity, created_at, is_read FROM security_alerts WHERE user_id = ? ORDER BY created_at DESC LIMIT 20");
    $stmt->execute([$userId]);
    $alerts = $stmt->fetchAll();

    // 4. Rate Limit Events (last 50)
    $stmt = $pdo->prepare("SELECT endpoint, ip_address, created_at FROM rate_limit_events WHERE user_id = ? ORDER BY created_at DESC LIMIT 50");
    $stmt->execute([$userId]);
    $rateLimitEvents = $stmt->fetchAll();

    // 5. Abuse Events (last 50)
    $stmt = $pdo->prepare("SELECT event_type, weight, ip_address, created_at FROM abuse_events WHERE user_id = ? ORDER BY created_at DESC LIMIT 50");
    $stmt->execute([$userId]);
    $abuseEvents = $stmt->fetchAll();

    echo json_encode([
        'success' => true,
        'user_id' => $userId,
        'abuse_score' => $abuseScore,
        'devices' => $devices,
        'security_alerts' => $alerts,
        'rate_limit_events' => $rateLimitEvents,
        'abuse_events' => $abuseEvents
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'SERVER_ERROR']);
}
