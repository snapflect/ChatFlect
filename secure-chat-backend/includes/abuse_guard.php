<?php
// includes/abuse_guard.php
// Epic 52: Enforces Bans & Escalates Rate Limit Violations
// Hardened (HF-52): Policy Registry, Allowlist, Scoring, Escalation

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/audit_logger.php';

class AbuseGuard
{
    private $pdo;
    private $logger;
    private $policy;
    private $trustEngine;

    public function __construct($pdo)
    {
        $this->pdo = $pdo;
        $this->logger = new AuditLogger($pdo);
        $this->loadPolicy();
        // HF-55.1: Trust Integration
        require_once __DIR__ . '/trust_score_engine.php';
        $this->trustEngine = new TrustScoreEngine($pdo);
    }


    private function loadPolicy()
    {
        $json = @file_get_contents(__DIR__ . '/../docs/rate_limit_policy.json');
        $this->policy = json_decode($json, true) ?: [];
    }

    public function checkAccess($ip, $userId = null, $deviceId = null)
    {
        // HF-52.6: Allowlist Support
        if (in_array($ip, $this->policy['allowlist'] ?? [])) {
            return; // Bypass checks
        }

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

    // HF-52.3: Global Abuse Score Engine
    public function reportViolation($type, $value, $violationType = 'rate_limit_hit')
    {
        $points = $this->policy['abuse_scores'][$violationType] ?? 1;
        $targetKey = md5("$type:$value");

        // Upsert Score
        $sql = "INSERT INTO abuse_scores (target_key, score, last_updated) 
                VALUES (?, ?, NOW()) 
                ON DUPLICATE KEY UPDATE score = score + VALUES(score), last_updated = NOW()";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$targetKey, $points]);

        // Check Threshold (Default 100)
        $newScore = $this->getScore($targetKey);
        if ($newScore >= 100) {
            $this->escalateBan($type, $value);
        }
    }

    private function getScore($targetKey)
    {
        $stmt = $this->pdo->prepare("SELECT score FROM abuse_scores WHERE target_key = ?");
        $stmt->execute([$targetKey]);
        return (int) $stmt->fetchColumn();
    }

    // HF-52.2: Progressive Ban Escalation
    private function escalateBan($type, $value)
    {
        // Simulating ladder logic: 1m -> 10m -> 1h -> 24h
        // In prod: Query past infractions to pick next rung.
        // For simulation: Default to '1 HOUR' or pick from policy.

        $ladder = $this->policy['escalation_ladder'] ?? ['1 HOUR'];
        $duration = $ladder[2] ?? '1 HOUR'; // Default to 1h for serious violations

        $this->ban($type, $value, $duration, 'ABUSE_SCORE_THRESHOLD');
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

        $this->logger->log('BAN_APPLIED', 'WARNING', ['type' => $type, 'value' => $value, 'reason' => $reason, 'duration' => $duration]);

        // Reset Score after Ban
        $this->pdo->prepare("UPDATE abuse_scores SET score = 0 WHERE target_key = ?")->execute([md5("$type:$value")]);
    }
}
