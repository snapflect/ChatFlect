<?php
// includes/admin_identity_manager.php
// Epic 58 HF: Manage multi-admin identities

require_once __DIR__ . '/db_connect.php';

class AdminIdentityManager
{
    private $pdo;

    public function __construct($pdo)
    {
        $this->pdo = $pdo;
    }

    public function getIdentity($adminId)
    {
        $stmt = $this->pdo->prepare("SELECT * FROM admin_identities WHERE admin_id = ?");
        $stmt->execute([$adminId]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    public function registerIdentity($adminId, $role)
    {
        $stmt = $this->pdo->prepare("INSERT INTO admin_identities (admin_id, role) VALUES (?, ?) ON DUPLICATE KEY UPDATE role = VALUES(role)");
        $stmt->execute([$adminId, $role]);
    }

    public function verifyRole($adminId, $requiredRole)
    {
        $id = $this->getIdentity($adminId);
        if (!$id || $id['status'] !== 'ACTIVE')
            return false;
        if ($requiredRole === 'ANY')
            return true;
        if ($id['role'] === 'SUPER_ADMIN')
            return true;
        return $id['role'] === $requiredRole;
    }
}
