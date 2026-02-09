<?php
// includes/trust_score_engine.php
// Epic 55: Trust Score Engine
// Calculates and updates trust scores based on events.

require_once __DIR__ . '/db_connect.php';

class TrustScoreEngine
{
    private $pdo;

    // Configurable weights
    const WEIGHTS = [
        'RATE_LIMIT_HIT' => -10,
        'BAN_TEMPORARY' => -50,
        'BAN_PERMANENT' => -1000,
        'CAPTCHA_FAIL' => -20,
        'DEVICE_REVOKED' => -100,
        'CLEAN_DAY' => 5, // Daily bonus
        'TRUSTED_DEVICE_ADD' => 20
    ];

    const DEFAULTS = [
        'IP' => 200,
        'DEVICE' => 300,
        'USER' => 400
    ];

    public function __construct($pdo)
    {
        $this->pdo = $pdo;
    }

    public function logEvent($type, $value, $eventType, $reason = '')
    {
        $delta = self::WEIGHTS[$eventType] ?? 0;
        if ($delta === 0)
            return; // Unknown event

        try {
            $this->pdo->beginTransaction();

            // 1. Log Event
            $stmt = $this->pdo->prepare("INSERT INTO trust_score_events (actor_type, actor_value, event_type, score_delta, reason) VALUES (?, ?, ?, ?, ?)");
            $stmt->execute([$type, $value, $eventType, $delta, $reason]);

            // 2. Update Score
            // Ensure record exists
            $currentScore = $this->getScore($type, $value);

            // Apply Delta
            $newScore = max(0, min(1000, $currentScore + $delta));

            $stmtUpd = $this->pdo->prepare("INSERT INTO trust_scores (actor_type, actor_value, trust_score) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE trust_score = ?");
            $stmtUpd->execute([$type, $value, $newScore, $newScore]);

            $this->pdo->commit();
            return $newScore;

        } catch (Exception $e) {
            $this->pdo->rollBack();
            error_log("TrustScore Error: " . $e->getMessage());
            return 0;
        }
    }

    public function getScore($type, $value)
    {
        $stmt = $this->pdo->prepare("SELECT trust_score FROM trust_scores WHERE actor_type = ? AND actor_value = ?");
        $stmt->execute([$type, $value]);
        $score = $stmt->fetchColumn();

        if ($score === false) {
            return self::DEFAULTS[$type] ?? 200;
        }
        return (int) $score;
    }
}
