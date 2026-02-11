<?php
// includes/group_permission_enforcer.php
// Epic 82: Group Admin Logic

require_once __DIR__ . '/db_connect.php';

class GroupPermissionEnforcer
{
    private $pdo;

    public function __construct($pdo)
    {
        $this->pdo = $pdo;
    }

    // Check if user has ADMIN or OWNER role
    private function isAdmin($groupId, $userId)
    {
        $stmt = $this->pdo->prepare("SELECT role FROM group_members WHERE group_id = ? AND user_id = ?");
        $stmt->execute([$groupId, $userId]);
        $role = $stmt->fetchColumn();
        return ($role === 'admin' || $role === 'owner');
    }

    public function canSendMessage($groupId, $userId)
    {
        $stmt = $this->pdo->prepare("SELECT only_admins_message FROM groups WHERE group_id = ?");
        $stmt->execute([$groupId]);
        $restricted = $stmt->fetchColumn();

        if (!$restricted)
            return true;
        return $this->isAdmin($groupId, $userId);
    }

    public function canEditGroupInfo($groupId, $userId)
    {
        $stmt = $this->pdo->prepare("SELECT only_admins_edit_info FROM groups WHERE group_id = ?");
        $stmt->execute([$groupId]);
        $restricted = $stmt->fetchColumn();

        if (!$restricted)
            return true;
        return $this->isAdmin($groupId, $userId);
    }

    public function canAddParticipants($groupId, $userId)
    {
        $stmt = $this->pdo->prepare("SELECT only_admins_add_users FROM groups WHERE group_id = ?");
        $stmt->execute([$groupId]);
        $restricted = $stmt->fetchColumn();

        // Note: Default usually ANY member can add? Or only admins? 
        // If DB has explicit flag, use it.
        // If default is TRUE (only admins), then we check logic.
        // Assume default FALSE means anyone.

        if (!$restricted)
            return true;
        return $this->isAdmin($groupId, $userId);
    }

    public function logAction($groupId, $userId, $action, $details = [])
    {
        // Unifying with legacy group_audit_log (Epic 43)
        // Table: group_audit_log (group_id, actor_user_id, target_user_id, action, metadata)
        // Map details to metadata
        $targetId = $details['target_user_id'] ?? $details['target'] ?? null;

        $stmt = $this->pdo->prepare("INSERT INTO group_audit_log (group_id, actor_user_id, target_user_id, action, metadata) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([$groupId, $userId, $targetId, $action, json_encode($details)]);
    }
}
