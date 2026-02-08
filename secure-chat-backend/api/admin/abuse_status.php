<?php
// api/admin/abuse_status.php
// Epic 24: Spam Detection - Admin Endpoint

require_once __DIR__ . '/../../includes/db_connect.php';
require_once __DIR__ . '/../../includes/abuse_detector.php';

header('Content-Type: application/json');

// Admin Protection: Require X-Admin-Token header
$adminToken = getenv('ADMIN_API_TOKEN') ?: 'CHANGE_ME_IN_PRODUCTION';
$providedToken = $_SERVER['HTTP_X_ADMIN_TOKEN'] ?? '';

if ($providedToken !== $adminToken) {
    http_response_code(401);
    echo json_encode(['error' => 'UNAUTHORIZED', 'message' => 'Invalid admin token']);
    exit;
}

// Get User ID from query
$userId = $_GET['user_id'] ?? null;

if (!$userId) {
    http_response_code(400);
    echo json_encode(['error' => 'MISSING_USER_ID']);
    exit;
}

try {
    // Get abuse score
    $scoreData = getAbuseScore($pdo, $userId);

    // Get recent events (last 10)
    $stmt = $pdo->prepare("
        SELECT event_type, weight, created_at, metadata 
        FROM abuse_events 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT 10
    ");
    $stmt->execute([$userId]);
    $events = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'user_id' => $userId,
        'score' => $scoreData['score'],
        'risk_level' => $scoreData['risk_level'],
        'cooldown_until' => $scoreData['cooldown_until'],
        'recent_events' => $events
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'SERVER_ERROR']);
}
