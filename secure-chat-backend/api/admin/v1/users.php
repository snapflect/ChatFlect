<?php
// api/admin/v1/users.php
// Epic 27: Admin Dashboard - Search Users

require_once __DIR__ . '/../../../includes/admin_auth.php';

header('Content-Type: application/json');

try {
    $adminId = requireAdminAuth();
    $pdo = getAdminPdo();

    // Search parameters
    $search = $_GET['search'] ?? null;
    $riskLevel = $_GET['risk_level'] ?? null;
    $limit = isset($_GET['limit']) ? min((int) $_GET['limit'], 100) : 50;

    // Build query
    $sql = "
        SELECT 
            u.user_id,
            COALESCE(a.score, 0) as abuse_score,
            COALESCE(a.risk_level, 'LOW') as risk_level,
            a.cooldown_until,
            (SELECT COUNT(*) FROM user_devices d WHERE d.user_id = u.user_id AND d.status = 'active') as active_devices,
            (SELECT MAX(last_seen) FROM presence p WHERE p.user_id = u.user_id) as last_seen
        FROM users u
        LEFT JOIN abuse_scores a ON u.user_id = a.user_id
        WHERE 1=1
    ";
    $params = [];

    if ($search) {
        $sql .= " AND u.user_id LIKE ?";
        $params[] = "%$search%";
    }

    if ($riskLevel) {
        $sql .= " AND COALESCE(a.risk_level, 'LOW') = ?";
        $params[] = $riskLevel;
    }

    $sql .= " ORDER BY a.score DESC LIMIT ?";
    $params[] = $limit;

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'users' => $users,
        'count' => count($users)
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'SERVER_ERROR', 'message' => $e->getMessage()]);
}
