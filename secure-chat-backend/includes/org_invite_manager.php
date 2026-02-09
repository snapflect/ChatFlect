<?php
// includes/org_invite_manager.php
// Epic 60: Organization Invite Logic

require_once __DIR__ . '/db_connect.php';

class OrgInviteManager
{
    private $pdo;

    public function __construct($pdo)
    {
        $this->pdo = $pdo;
    }

    public function createInvite($orgIdBin, $inviterId, $email, $role)
    {
        // 1. Check if already member
        // (Skipped for brevity, assume API layer checks or DB constraints)

        // 2. Generate Token
        $token = bin2hex(random_bytes(32));
        $hash = hash('sha256', $token);
        $expires = date('Y-m-d H:i:s', strtotime('+24 hours'));

        $stmt = $this->pdo->prepare("INSERT INTO org_invites (org_id, invited_email, invited_by_user_id, invite_token, role, expires_at) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->execute([$orgIdBin, $email, $inviterId, $hash, $role, $expires]);

        return $token; // Return raw token to send via email
    }

    public function getInvite($token)
    {
        $hash = hash('sha256', $token);
        $stmt = $this->pdo->prepare("SELECT * FROM org_invites WHERE invite_token = ? AND status = 'PENDING'");
        $stmt->execute([$hash]);
        $invite = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$invite)
            return null;
        if (strtotime($invite['expires_at']) < time()) {
            // Update to expired
            $this->expireInvite($invite['invite_id']);
            return null;
        }
        return $invite;
    }

    public function acceptInvite($token, $userId)
    {
        $invite = $this->getInvite($token);
        if (!$invite)
            throw new Exception("Invalid or Expired Invite");

        try {
            $this->pdo->beginTransaction();

            // Add Member
            $stmt = $this->pdo->prepare("INSERT INTO org_members (org_id, user_id, role) VALUES (?, ?, ?)");
            $stmt->execute([$invite['org_id'], $userId, $invite['role']]);

            // Update Invite
            $stmt = $this->pdo->prepare("UPDATE org_invites SET status = 'ACCEPTED' WHERE invite_id = ?");
            $stmt->execute([$invite['invite_id']]);

            $this->pdo->commit();

            // Return Org ID (hex)
            return bin2hex($invite['org_id']);

        } catch (Exception $e) {
            $this->pdo->rollBack();
            if (strpos($e->getMessage(), 'Duplicate entry') !== false) {
                // User already in org, just close invite
                $stmt = $this->pdo->prepare("UPDATE org_invites SET status = 'ACCEPTED' WHERE invite_id = ?");
                $stmt->execute([$invite['invite_id']]);
                return bin2hex($invite['org_id']);
            }
            throw $e;
        }
    }

    private function expireInvite($id)
    {
        $stmt = $this->pdo->prepare("UPDATE org_invites SET status = 'EXPIRED' WHERE invite_id = ?");
        $stmt->execute([$id]);
    }
}
