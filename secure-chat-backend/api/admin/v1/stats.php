<?php
// api/admin/v1/stats.php
// Epic 27: Admin Dashboard - Dashboard Statistics

require_once __DIR__ . '/../../../includes/admin_auth.php';

header('Content-Type: application/json');

try {
    $adminId = requireAdminAuth();
    $pdo = getAdminPdo();

    // 1. Total messages last 24h
    $stmt = $pdo->query("SELECT COUNT(*) FROM messages WHERE created_at > NOW() - INTERVAL 24 HOUR");
    $messages24h = $stmt->fetchColumn() ?: 0;

    // 2. Total 429 events last 24h (rate limit hits)
    $stmt = $pdo->query("SELECT COUNT(*) FROM rate_limit_events WHERE created_at > NOW() - INTERVAL 24 HOUR");
    $rateLimitEvents24h = $stmt->fetchColumn() ?: 0;

    // 3. Total locked users (cooldown active)
    $stmt = $pdo->query("SELECT COUNT(*) FROM abuse_scores WHERE cooldown_until > NOW()");
    $lockedUsers = $stmt->fetchColumn() ?: 0;

    // 4. Top 10 abusive users
    $stmt = $pdo->query("
        SELECT user_id, score, risk_level, cooldown_until 
        FROM abuse_scores 
        ORDER BY score DESC 
        LIMIT 10
    ");
    $topAbusers = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // 5. Total users by risk level
    $stmt = $pdo->query("
        SELECT risk_level, COUNT(*) as count 
        FROM abuse_scores 
        GROUP BY risk_level
    ");
    $riskDistribution = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // 6. Recent admin actions (last 10)
    $stmt = $pdo->query("
        SELECT admin_id, target_user_id, action_type, created_at 
        FROM admin_actions 
        ORDER BY created_at DESC 
        LIMIT 10
    ");
    $recentActions = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // 7. Security alerts last 24h
    $stmt = $pdo->query("SELECT COUNT(*) FROM security_alerts WHERE created_at > NOW() - INTERVAL 24 HOUR");
    $alerts24h = $stmt->fetchColumn() ?: 0;

    echo json_encode([
        'success' => true,
        'stats' => [
            'messages_24h' => (int) $messages24h,
            'rate_limit_events_24h' => (int) $rateLimitEvents24h,
            'security_alerts_24h' => (int) $alerts24h,
            'locked_users' => (int) $lockedUsers,
            'risk_distribution' => $riskDistribution
        ],
        'top_abusers' => $topAbusers,
        'recent_admin_actions' => $recentActions
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'SERVER_ERROR', 'message' => $e->getMessage()]);
}
