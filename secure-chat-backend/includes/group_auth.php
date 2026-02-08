<?php
// includes/group_auth.php
// Epic 41: Group Auth + Membership Helpers

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/logger.php';

/**
 * Verify user is a member of the group (not removed).
 */
function requireGroupMember($pdo, string $groupId, string $userId): bool
{
    $stmt = $pdo->prepare("
        SELECT 1 FROM group_members 
        WHERE group_id = ? AND user_id = ? AND removed_at IS NULL
    ");
    $stmt->execute([$groupId, $userId]);

    if (!$stmt->fetch()) {
        http_response_code(403);
        echo json_encode(['error' => 'NOT_GROUP_MEMBER', 'message' => 'You are not a member of this group']);
        exit;
    }

    return true;
}

/**
 * Verify user is an admin of the group.
 */
function requireGroupAdmin($pdo, string $groupId, string $userId): bool
{
    $stmt = $pdo->prepare("
        SELECT role FROM group_members 
        WHERE group_id = ? AND user_id = ? AND removed_at IS NULL
    ");
    $stmt->execute([$groupId, $userId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row || $row['role'] !== 'admin') {
        http_response_code(403);
        echo json_encode(['error' => 'NOT_GROUP_ADMIN', 'message' => 'Admin privileges required']);
        exit;
    }

    return true;
}

/**
 * Get user's role in a group.
 */
function getGroupRole($pdo, string $groupId, string $userId): ?string
{
    $stmt = $pdo->prepare("
        SELECT role FROM group_members 
        WHERE group_id = ? AND user_id = ? AND removed_at IS NULL
    ");
    $stmt->execute([$groupId, $userId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    return $row ? $row['role'] : null;
}

/**
 * Check if group exists and is active.
 */
function getActiveGroup($pdo, string $groupId): ?array
{
    $stmt = $pdo->prepare("
        SELECT * FROM `groups` WHERE group_id = ? AND is_active = 1
    ");
    $stmt->execute([$groupId]);

    return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
}

/**
 * Log group audit event.
 */
function logGroupAudit(
    $pdo,
    string $groupId,
    string $actorUserId,
    string $action,
    ?string $targetUserId = null,
    ?array $metadata = null
): void {
    $stmt = $pdo->prepare("
        INSERT INTO group_audit_log (group_id, actor_user_id, target_user_id, action, metadata)
        VALUES (?, ?, ?, ?, ?)
    ");
    $stmt->execute([
        $groupId,
        $actorUserId,
        $targetUserId,
        $action,
        $metadata ? json_encode($metadata) : null
    ]);
}

/**
 * Generate UUIDv7 for group IDs.
 */
function generateGroupId(): string
{
    $time = (int) (microtime(true) * 1000);
    $timeHex = str_pad(dechex($time), 12, '0', STR_PAD_LEFT);
    $rand = bin2hex(random_bytes(8));

    return sprintf(
        '%s-%s-7%s-%s-%s',
        substr($timeHex, 0, 8),
        substr($timeHex, 8, 4),
        substr($rand, 0, 3),
        substr($rand, 3, 4),
        substr($rand, 7, 12)
    );
}
