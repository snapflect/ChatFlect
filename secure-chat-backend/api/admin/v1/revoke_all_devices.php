<?php
// api/admin/v1/revoke_all_devices.php
// Epic 27: Admin Dashboard - Revoke All Devices

require_once __DIR__ . '/../../../includes/admin_auth.php';
require_once __DIR__ . '/../../../includes/security_alerts.php';

header('Content-Type: application/json');

try {
    $adminId = requireAdminAuth();
    $pdo = getAdminPdo();

    $input = json_decode(file_get_contents('php://input'), true);
    $userId = $input['user_id'] ?? null;
    $reason = $input['reason'] ?? 'Admin emergency action';

    if (!$userId) {
        http_response_code(400);
        echo json_encode(['error' => 'MISSING_USER_ID']);
        exit;
    }

    // Get count of active devices before revoking
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM user_devices WHERE user_id = ? AND status = 'active'");
    $stmt->execute([$userId]);
    $deviceCount = $stmt->fetchColumn();

    // Revoke all devices
    $stmt = $pdo->prepare("UPDATE user_devices SET status = 'revoked', revoked_at = NOW() WHERE user_id = ? AND status = 'active'");
    $stmt->execute([$userId]);
    $revokedCount = $stmt->rowCount();

    // Clear all presence
    $pdo->prepare("DELETE FROM presence WHERE user_id = ?")->execute([$userId]);

    // Log admin action
    logAdminAction($pdo, $adminId, $userId, 'REVOKE_ALL_DEVICES', [
        'revoked_count' => $revokedCount,
        'reason' => $reason
    ]);

    // Create security alert
    createSecurityAlert($pdo, $userId, 'DEVICE_REVOKED', 'CRITICAL', null, null, [
        'revoked_by' => 'admin',
        'admin_id' => $adminId,
        'devices_revoked' => $revokedCount,
        'reason' => $reason,
        'message' => 'All devices revoked by administrator'
    ]);

    echo json_encode([
        'success' => true,
        'user_id' => $userId,
        'devices_revoked' => $revokedCount
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'SERVER_ERROR']);
}
