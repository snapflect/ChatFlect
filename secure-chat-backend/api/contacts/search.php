<?php
/**
 * api/contacts/search.php
 * Global Contact Discovery (v3.0)
 * Searches users by name or email for the global discovery section.
 */

require_once '../db.php';
require_once '../auth_middleware.php';
require_once '../rate_limiter.php';

// Rate limit: 30 requests per hour to prevent abuse
enforceRateLimit(null, 30, 3600);

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(["error" => "Method Not Allowed"]);
    exit;
}

$query = isset($_GET['q']) ? trim($_GET['q']) : '';

if (strlen($query) < 2) {
    echo json_encode(["success" => true, "results" => []]);
    exit;
}

// Sanitize
$query = htmlspecialchars($query, ENT_QUOTES, 'UTF-8');
$search = "%" . $query . "%";

$stmt = $conn->prepare("
    SELECT user_id, email, first_name, last_name, photo_url, short_note 
    FROM users 
    WHERE (first_name LIKE ? OR last_name LIKE ? OR email LIKE ?)
    AND status != 'blocked'
    LIMIT 20
");
$stmt->bind_param("sss", $search, $search, $search);
$stmt->execute();
$result = $stmt->get_result();

$matches = [];
while ($row = $result->fetch_assoc()) {
    // Build photo URL
    $photoUrl = null;
    if (!empty($row['photo_url'])) {
        if (strpos($row['photo_url'], 'http') === 0) {
            $photoUrl = $row['photo_url'];
        } else {
            $photoUrl = 'serve.php?file=' . ltrim($row['photo_url'], '/');
        }
    }

    $matches[] = [
        "user_id" => $row['user_id'],
        "first_name" => $row['first_name'],
        "last_name" => $row['last_name'],
        "email" => $row['email'],
        "photo_url" => $photoUrl,
        "short_note" => $row['short_note'] ?? null
    ];
}

echo json_encode([
    "success" => true,
    "results" => $matches
]);
