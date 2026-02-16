<?php
// api/v4/groups/update_permissions.php
require_once __DIR__ . '/../../includes/auth_middleware.php';
require_once __DIR__ . '/../../includes/group_permission_enforcer.php';

$user = authenticate();
$input = json_decode(file_get_contents('php://input'), true);

$groupId = hex2bin($input['group_id']);
$enforcer = new GroupPermissionEnforcer($pdo);

// 1. Only Admins can change Permissions
// We re-use isAdmin logic (public implementation needed or reflection? Let's make it public or duplicate)
// Actually isAdmin was private. I should make checkAdmin helper.
// For now, let's assume raw query here or Enforcer adds `isStartAdmin`.
// Let's rely on standard group role check.

$stmt = $pdo->prepare("SELECT role FROM group_members WHERE group_id = ? AND user_id = ?");
$stmt->execute([$groupId, $user['user_id']]);
$role = $stmt->fetchColumn();

if ($role !== 'admin' && $role !== 'owner') {
    http_response_code(403);
    echo json_encode(['error' => 'Only admins can change permissions']);
    exit;
}

// 2. Update Flags
$allowed = ['only_admins_message', 'only_admins_edit_info', 'only_admins_add_users', 'approval_required_to_join'];
$updates = [];
$params = [];

foreach ($allowed as $field) {
    if (isset($input[$field])) {
        $updates[] = "$field = ?";
        $params[] = (int) $input[$field];
    }
}

if (empty($updates)) {
    echo json_encode(['success' => true, 'message' => 'No changes']);
    exit;
}

$params[] = $groupId;
$sql = "UPDATE groups SET " . implode(', ', $updates) . " WHERE group_id = ?";
$stmt = $pdo->prepare($sql);
$stmt->execute($params);

// 3. Log
$enforcer->logAction($groupId, $user['user_id'], 'UPDATE_PERMISSIONS', $input);

echo json_encode(['success' => true]);
