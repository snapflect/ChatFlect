<?php
// includes/admin_auth.php
// Epic 27: Admin Moderation Dashboard - Authentication

/**
 * Require admin authentication via X-Admin-Token header.
 * Returns admin identifier or exits with 401/403.
 */
function requireAdminAuth()
{
    $adminToken = getenv('ADMIN_API_TOKEN') ?: 'CHANGE_ME_IN_PRODUCTION';
    $providedToken = $_SERVER['HTTP_X_ADMIN_TOKEN'] ?? '';

    if (empty($providedToken)) {
        http_response_code(401);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'MISSING_ADMIN_TOKEN']);
        exit;
    }

    if ($providedToken !== $adminToken) {
        http_response_code(403);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'INVALID_ADMIN_TOKEN']);
        exit;
    }

    // Return admin identifier (from header or default)
    return $_SERVER['HTTP_X_ADMIN_ID'] ?? 'admin';
}

/**
 * Log an admin action to the admin_actions table.
 */
function logAdminAction($pdo, $adminId, $targetUserId, $actionType, $metadata = null)
{
    $stmt = $pdo->prepare("
        INSERT INTO admin_actions (admin_id, target_user_id, action_type, metadata)
        VALUES (?, ?, ?, ?)
    ");
    $metaJson = $metadata ? json_encode($metadata) : null;
    $stmt->execute([$adminId, $targetUserId, $actionType, $metaJson]);

    return $pdo->lastInsertId();
}

/**
 * Get PDO connection (reuses from db.php if available, otherwise creates new)
 */
function getAdminPdo()
{
    if (function_exists('getDbPdo')) {
        return getDbPdo();
    }

    static $pdo = null;
    if ($pdo === null) {
        $pdo = new PDO(
            'mysql:host=localhost;dbname=u668772406_secure_chat;charset=utf8mb4',
            'u668772406_chat_admin',
            'MusMisMM@1',
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
            ]
        );
    }
    return $pdo;
}
