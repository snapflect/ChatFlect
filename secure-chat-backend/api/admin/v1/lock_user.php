<?php
// api/admin/v1/lock_user.php
// Epic 27: Admin Dashboard - Lock User

require_once __DIR__ . '/../../../includes/admin_auth.php';
require_once __DIR__ . '/../../../includes/security_alerts.php';

header('Content-Type: application/json');

try {
    $adminId = requireAdminAuth();
    $pdo = getAdminPdo();

    $input = json_decode(file_get_contents('php://input'), true);
    $userId = $input['user_id'] ?? null;
    $minutes = $input['minutes'] ?? 60;
    $reason = $input['reason'] ?? 'Admin action';

    if (!$userId) {
        http_response_code(400);
        echo json_encode(['error' => 'MISSING_USER_ID']);
        exit;
    }

    // Update abuse_scores or insert
    $stmt = $pdo->prepare("
        INSERT INTO abuse_scores (user_id, score, risk_level, cooldown_until)
        VALUES (?, 200, 'CRITICAL', DATE_ADD(NOW(), INTERVAL ? MINUTE))
        ON DUPLICATE KEY UPDATE 
            risk_level = 'CRITICAL',
            cooldown_until = DATE_ADD(NOW(), INTERVAL ? MINUTE),
            last_updated = NOW()
    ");
    $stmt->execute([$userId, $minutes, $minutes]);

    // Log admin action
    logAdminAction($pdo, $adminId, $userId, 'LOCK_USER', [
        'minutes' => $minutes,
        'reason' => $reason
    ]);

    // Create security alert
    createSecurityAlert($pdo, $userId, 'ABUSE_LOCK', 'CRITICAL', null, null, [
        'locked_by' => 'admin',
        'admin_id' => $adminId,
        'reason' => $reason,
        'duration_minutes' => $minutes,
        'message' => 'Account locked by administrator'
    ]);

    echo json_encode([
        'success' => true,
        'user_id' => $userId,
        'locked_until' => date('Y-m-d H:i:s', strtotime("+$minutes minutes"))
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'SERVER_ERROR']);
}
