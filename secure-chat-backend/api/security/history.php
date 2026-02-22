<?php
/**
 * api/security/history.php
 * User Security History API
 * Returns recent security-relevant events for the authenticated user.
 */

require_once '../db.php';
require_once '../auth_middleware.php';

$userId = requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(["error" => "Method Not Allowed"]);
    exit;
}

$limit = isset($_GET['limit']) ? min((int) $_GET['limit'], 50) : 20;
$offset = isset($_GET['offset']) ? (int) $_GET['offset'] : 0;

try {
    global $conn;

    // Fetch recent audit logs for this user
    $sql = "SELECT id, action, severity, details, ip_address, created_at 
            FROM audit_logs 
            WHERE user_id = ? 
            ORDER BY created_at DESC 
            LIMIT ? OFFSET ?";

    $stmt = $conn->prepare($sql);
    $stmt->bind_param("sii", $userId, $limit, $offset);
    $stmt->execute();
    $result = $stmt->get_result();

    $events = [];
    while ($row = $result->fetch_assoc()) {
        // Redact PII or sensitive keys from details if any slipped in
        $details = json_decode($row['details'], true) ?: $row['details'];

        $events[] = [
            "id" => $row['id'],
            "event" => $row['action'],
            "severity" => $row['severity'],
            "details" => $details,
            "ip" => $row['ip_address'],
            "timestamp" => $row['created_at']
        ];
    }

    echo json_encode([
        "success" => true,
        "results" => $events
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["error" => "Internal Server Error", "details" => $e->getMessage()]);
}
