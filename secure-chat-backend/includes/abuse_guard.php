<?php
// includes/abuse_guard.php
// Epic 60 HF: Security Rate Limiting & Quotas

require_once __DIR__ . '/db_connect.php';

class AbuseGuard
{
    private $pdo;

    public function __construct($pdo)
    {
        $this->pdo = $pdo;
    }

    public function checkInviteQuota($orgIdBin, $inviterId)
    {
        $today = date('Y-m-d') . '%';

        // 1. Org Daily Limit (20 invites/day)
        $stmt = $this->pdo->prepare("SELECT COUNT(*) FROM org_invites WHERE org_id = ? AND created_at LIKE ?");
        $stmt->execute([$orgIdBin, $today]);
        if ($stmt->fetchColumn() >= 20) {
            throw new Exception("Invite Quota Exceeded (Org Daily Limit: 20)");
        }

        // 2. User Hourly Limit (5 invites/hour)
        $hourAgo = date('Y-m-d H:i:s', strtotime('-1 hour'));
        $stmt = $this->pdo->prepare("SELECT COUNT(*) FROM org_invites WHERE invited_by_user_id = ? AND created_at > ?");
        $stmt->execute([$inviterId, $hourAgo]);
        if ($stmt->fetchColumn() >= 5) {
            throw new Exception("Invite Quota Exceeded (User Hourly Limit: 5)");
        }
    }
}
