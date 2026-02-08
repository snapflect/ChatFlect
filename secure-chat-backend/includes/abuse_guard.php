<?php
// includes/abuse_guard.php
// Epic 52: Enforces Bans & Escalates Rate Limit Violations
// Middleware-style check

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/audit_logger.php';

class AbuseGuard
{
    private $pdo;
    private $logger;

    public function __construct($pdo)
    {
        $this->pdo = $pdo;
        $this->logger = new AuditLogger($pdo);
    }

    public function checkAccess($ip, $userId = null, $deviceId = null)
    {
        // 1. Check IP Ban
        if ($this->isBanned('IP', $ip)) {
            $this->block('IP_BANNED');
        }

        // 2. Check User Ban
        if ($userId && $this->isBanned('USER', $userId)) {
            $this->block('USER_BANNED');
        }

        // 3. Check Device Ban
        if ($deviceId && $this->isBanned('DEVICE', $deviceId)) {
            $this->block('DEVICE_BANNED');
        }
    }

    private function isBanned($type, $value)
    {
        $stmt = $this->pdo->prepare("
            SELECT 1 FROM ip_banlist 
            WHERE target_type = ? AND target_value = ? 
            AND (expires_at IS NULL OR expires_at > NOW())
        ");
        $stmt->execute([$type, $value]);
        return (bool) $stmt->fetchColumn();
    }

    private function block($reason)
    {
        http_response_code(403);
        echo json_encode(['error' => $reason]);
        exit;
    }

    public function ban($type, $value, $duration = '1 HOUR', $reason = 'ABUSE')
    {
        $expires = ($duration === 'PERMANENT') ? null : date('Y-m-d H:i:s', strtotime("+ $duration"));

        $stmt = $this->pdo->prepare("
            INSERT INTO ip_banlist (target_type, target_value, reason, expires_at)
            VALUES (?, ?, ?, ?)
        ");
        $stmt->execute([$type, $value, $reason, $expires]);

        $this->logger->log('BAN_APPLIED', 'WARNING', ['type' => $type, 'value' => $value, 'reason' => $reason]);
    }
}
