<?php
require_once 'db.php';
require_once 'auth_middleware.php';

// Enforce authentication (includes Rate Limiting & Block check)
$userId = requireAuth();

// --- ROLE CHECK (v13) ---
// Ensure user is an admin
$stmt = $conn->prepare("SELECT role FROM users WHERE user_id = ?");
$stmt->bind_param("s", $userId);
$stmt->execute();
$res = $stmt->get_result();
$row = $res->fetch_assoc();

if (!$row || $row['role'] !== 'admin') {
    http_response_code(403);
    echo json_encode(["error" => "Access Denied - Admin privileges required"]);
    exit;
}

$action = $_GET['action'] ?? '';

if ($action === 'audit-logs') {
    // Paginated Audit Logs
    $page = isset($_GET['page']) ? (int) $_GET['page'] : 1;
    $limit = 50;
    $offset = ($page - 1) * $limit;

    $stmt = $conn->prepare("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ? OFFSET ?");
    $stmt->bind_param("ii", $limit, $offset);
    $stmt->execute();
    $logs = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

    echo json_encode(['data' => $logs]);

} elseif ($action === 'stats') {
    // Security Stats (24h)

    // Failed Logins (24h)
    $stmt = $conn->query("SELECT COUNT(*) as count FROM audit_logs WHERE action = 'auth_failed' AND created_at > NOW() - INTERVAL 24 HOUR");
    $failedLogins = $stmt->fetch_assoc()['count'];

    // Blocked Users Total
    $stmt = $conn->query("SELECT COUNT(*) as count FROM users WHERE is_blocked = 1");
    $blockedUsers = $stmt->fetch_assoc()['count'];

    // Active Sessions (Recent)
    $stmt = $conn->query("SELECT COUNT(*) as count FROM user_sessions WHERE last_active > NOW() - INTERVAL 1 HOUR");
    $activeSessions = $stmt->fetch_assoc()['count'];

    echo json_encode([
        'failed_logins_24h' => $failedLogins,
        'blocked_users_total' => $blockedUsers,
        'active_sessions_1h' => $activeSessions
    ]);

} else {
    http_response_code(400);
    echo json_encode(["error" => "Invalid action"]);
}
?>