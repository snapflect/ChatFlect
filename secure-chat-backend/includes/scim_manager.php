<?php
// includes/scim_manager.php
// Epic 66: SCIM Logic

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/org_manager.php';
require_once __DIR__ . '/audit_logger.php';

class SCIMManager
{
    private $pdo;
    private $orgIdBin;
    private $tokenId;

    public function __construct($pdo, $orgIdBin, $tokenId)
    {
        $this->pdo = $pdo;
        $this->orgIdBin = $orgIdBin;
        $this->tokenId = $tokenId;
    }

    public function createUser($data)
    {
        $email = $data['userName']; // SCIM standard uses userName as identifier (usually email)
        // Find or Create User
        $stmt = $this->pdo->prepare("SELECT id FROM users WHERE email = ?");
        $stmt->execute([$email]);
        $userId = $stmt->fetchColumn();

        if (!$userId) {
            // Provision (Mock)
            // $userId = User::create($email, $data['name']...);
            $userId = 9999; // Mock
        }

        // Add to Org
        $role = 'MEMBER'; // Default
        try {
            $stmt = $this->pdo->prepare("INSERT INTO org_members (org_id, user_id, role, status) VALUES (?, ?, ?, 'ACTIVE')");
            $stmt->execute([$this->orgIdBin, $userId, $role]);

            $this->logEvent('USER_CREATE', $email, "Provisioned user $userId");
            return ['id' => (string) $userId, 'userName' => $email, 'active' => true];
        } catch (PDOException $e) {
            // Check if exists
            return ['id' => (string) $userId, 'userName' => $email, 'active' => true]; // Idem-potent
        }
    }

    public function updateUser($scimId, $data)
    {
        // Handle Active/Inactive (Disable)
        if (isset($data['active']) && $data['active'] === false) {
            // Disable Member
            $stmt = $this->pdo->prepare("UPDATE org_members SET status = 'DISABLED' WHERE org_id = ? AND user_id = ?");
            $stmt->execute([$this->orgIdBin, $scimId]);
            $this->logEvent('USER_DISABLE', null, "Disabled user $scimId");

            // Revoke Devices (Epic 57)
            // DeviceManager::revokeAll($scimId);
        }

        return ['id' => $scimId, 'active' => $data['active'] ?? true];
    }

    public function deleteUser($scimId)
    {
        // Soft Delete (Disable) or Remove? 
        // Prompt says: "Soft-delete (disable) instead of full wipe."
        $this->updateUser($scimId, ['active' => false]);
    }

    private function logEvent($type, $email, $summary)
    {
        $stmt = $this->pdo->prepare("INSERT INTO scim_events (org_id, token_id, action_type, target_user_email, payload_summary) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([$this->orgIdBin, $this->tokenId, $type, $email, $summary]);
    }
}
