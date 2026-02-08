<?php
// api/admin/v1/reset_abuse_score.php
// Epic 27: Admin Dashboard - Reset Abuse Score

require_once __DIR__ . '/../../../includes/admin_auth.php';

header('Content-Type: application/json');

try {
    $adminId = requireAdminAuth();
    $pdo = getAdminPdo();

    $input = json_decode(file_get_contents('php://input'), true);
    $userId = $input['user_id'] ?? null;

    if (!$userId) {
        http_response_code(400);
        echo json_encode(['error' => 'MISSING_USER_ID']);
        exit;
    }

    // Reset abuse score to 0 and LOW
    $stmt = $pdo->prepare("
        UPDATE abuse_scores 
        SET score = 0, risk_level = 'LOW', cooldown_until = NULL, last_updated = NOW()
        WHERE user_id = ?
    ");
    $stmt->execute([$userId]);

    // Log admin action
    logAdminAction($pdo, $adminId, $userId, 'RESET_ABUSE_SCORE', null);

    echo json_encode([
        'success' => true,
        'user_id' => $userId,
        'new_score' => 0,
        'new_risk_level' => 'LOW'
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'SERVER_ERROR']);
}
