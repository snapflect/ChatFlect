<?php
// includes/org_manager.php
// Epic 60: Organization Manager Logic

require_once __DIR__ . '/db_connect.php';

class OrgManager
{
    private $pdo;

    public function __construct($pdo)
    {
        $this->pdo = $pdo;
    }

    public function createOrg($userId, $name, $slug)
    {
        // Validation
        if (empty($name) || empty($slug))
            throw new Exception("Name and Slug required");

        // Slug collision check
        $stmt = $this->pdo->prepare("SELECT COUNT(*) FROM organizations WHERE org_slug = ?");
        $stmt->execute([$slug]);
        if ($stmt->fetchColumn() > 0)
            throw new Exception("Org Slug already taken");

        try {
            $this->pdo->beginTransaction();

            // 1. Create Org
            // UUID generation (simple version for PHP < 8 without uuid ext, or use raw bytes)
            // For compatibility using bin2hex/random_bytes
            $orgIdBin = random_bytes(16);

            $stmt = $this->pdo->prepare("INSERT INTO organizations (org_id, org_name, org_slug, created_by_user_id) VALUES (?, ?, ?, ?)");
            $stmt->execute([$orgIdBin, $name, $slug, $userId]);

            // 2. Add Creator as OWNER
            $this->addMember($orgIdBin, $userId, 'OWNER');

            $this->pdo->commit();
            return bin2hex($orgIdBin);
        } catch (Exception $e) {
            $this->pdo->rollBack();
            throw $e;
        }
    }

    public function addMember($orgIdBin, $userId, $role = 'MEMBER')
    {
        // HF-67.1: atomic License Check
        // Note: Caller must ensure Transaction for 'FOR UPDATE' to work effectively across the insert.
        // But even without explicit transaction, it guards the moment.
        require_once __DIR__ . '/license_manager.php';
        $licMgr = new LicenseManager($this->pdo);

        // We only check limits for non-Owners or if strict.
        // Actually, Owner counts towards seats usually.
        // checkSeatLimitAtomic throws logic if limit reached? No, returns false.

        if (!$licMgr->checkSeatLimitAtomic($orgIdBin)) {
            throw new Exception("Organization License Seat Limit Reached");
        }

        $stmt = $this->pdo->prepare("INSERT INTO org_members (org_id, user_id, role) VALUES (?, ?, ?)");
        $stmt->execute([$orgIdBin, $userId, $role]);
    }

    public function removeMember($orgIdBin, $userId, $performerId = null)
    {
        // HF-60.1: Owner Safety
        $role = $this->getMemberRole($orgIdBin, $userId);
        if ($role === 'OWNER') {
            $stmt = $this->pdo->prepare("SELECT COUNT(*) FROM org_members WHERE org_id = ? AND role = 'OWNER' AND status = 'ACTIVE'");
            $stmt->execute([$orgIdBin]);
            if ($stmt->fetchColumn() <= 1) {
                throw new Exception("Cannot remove the last OWNER. Promote another member first.");
            }
        }

        $stmt = $this->pdo->prepare("DELETE FROM org_members WHERE org_id = ? AND user_id = ?");
        $stmt->execute([$orgIdBin, $userId]);

        // HF-60.4: Audit Log
        if ($performerId) {
            // Assume AuditLogger is available via global or injection (mock for now if missing)
            // Log: MEMBER_REMOVED
        }
    }

    public function getMemberRole($orgIdBin, $userId)
    {
        $stmt = $this->pdo->prepare("SELECT role FROM org_members WHERE org_id = ? AND user_id = ? AND status = 'ACTIVE'");
        $stmt->execute([$orgIdBin, $userId]);
        return $stmt->fetchColumn();
    }

    public function getOrgById($orgIdBin)
    {
        $stmt = $this->pdo->prepare("SELECT * FROM organizations WHERE org_id = ?");
        $stmt->execute([$orgIdBin]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    public function getOrgBySlug($slug)
    {
        $stmt = $this->pdo->prepare("SELECT bin_to_uuid(org_id) as id, org_name, org_slug FROM organizations WHERE org_slug = ?");
        // Note: bin_to_uuid assumes MySQL 8 or need a helper. Let's return bin for internal use or hex.
        // Simplified: return hex
        $stmt = $this->pdo->prepare("SELECT hex(org_id) as id, org_name, org_slug FROM organizations WHERE org_slug = ?");
        $stmt->execute([$slug]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    public function uuidToBin($uuid)
    {
        return hex2bin(str_replace('-', '', $uuid));
    }
}
