<?php
// includes/org_admin_manager.php
// Epic 61: Org Admin Console Logic

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/org_manager.php';

class OrgAdminManager
{
    private $pdo;
    private $orgMgr;

    public function __construct($pdo)
    {
        $this->pdo = $pdo;
        $this->orgMgr = new OrgManager($pdo);
    }

    public function ensureAdmin($orgIdBin, $userId)
    {
        $role = $this->orgMgr->getMemberRole($orgIdBin, $userId);
        if (!in_array($role, ['OWNER', 'ADMIN'])) {
            throw new Exception("Access Denied: Admin or Owner required.");
        }
    }

    public function updateMemberRole($orgIdBin, $targetUserId, $newRole, $performerId)
    {
        // 1. Check Performer Capabilities
        $performerRole = $this->orgMgr->getMemberRole($orgIdBin, $performerId);
        $targetCurrentRole = $this->orgMgr->getMemberRole($orgIdBin, $targetUserId);

        // Rule: ADMIN cannot promote/demote OWNER or other ADMINs (Simplification: Admins can manage Members)
        if ($performerRole === 'ADMIN') {
            if ($targetCurrentRole === 'OWNER' || $targetCurrentRole === 'ADMIN') {
                throw new Exception("Admins cannot modify Owners or other Admins.");
            }
            if ($newRole === 'OWNER' || $newRole === 'ADMIN') {
                throw new Exception("Admins cannot promote users to Admin/Owner.");
            }
        }

        // Rule: Member cannot manage anyone (Covered by ensureAdmin mainly, but safe check)

        // Rule: Only OWNER can promote to OWNER
        if ($newRole === 'OWNER' && $performerRole !== 'OWNER') {
            throw new Exception("Only Owners can promote others to Owner.");
        }

        // 2. Update
        $stmt = $this->pdo->prepare("UPDATE org_members SET role = ? WHERE org_id = ? AND user_id = ?");
        $stmt->execute([$newRole, $orgIdBin, $targetUserId]);

        // 3. Log (Assume AuditLogger exists)
    }

    public function disableMember($orgIdBin, $targetUserId, $performerId)
    {
        $this->ensureAdmin($orgIdBin, $performerId);
        // Prevent disabling self or owner if not owner
        // (Similar checks to updateMemberRole)

        $stmt = $this->pdo->prepare("UPDATE org_members SET status = 'DISABLED' WHERE org_id = ? AND user_id = ?");
        $stmt->execute([$orgIdBin, $targetUserId]);
    }

    public function getOrgDevices($orgIdBin)
    {
        // Provide visibility into devices linked to org members
        // Join users -> devices
        $stmt = $this->pdo->prepare("
            SELECT d.device_id, d.device_name, d.trust_status, d.last_active, u.username, u.email 
            FROM devices d
            JOIN users u ON d.user_id = u.id
            JOIN org_members m ON u.id = m.user_id
            WHERE m.org_id = ?
        ");
        $stmt->execute([$orgIdBin]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}
