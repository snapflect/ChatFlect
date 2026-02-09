<?php
// includes/trust_score_manager.php
// Epic 55: Trust Score Manager
// Read-only / Management interface for APIs.

require_once __DIR__ . '/trust_score_engine.php';

class TrustScoreManager
{
    private $engine;
    private $pdo;

    public function __construct($pdo)
    {
        $this->pdo = $pdo;
        $this->engine = new TrustScoreEngine($pdo);
    }

    public function getTrustProfile($type, $value)
    {
        $stmt = $this->pdo->prepare("SELECT trust_score, trust_level, last_updated_at FROM trust_scores WHERE actor_type = ? AND actor_value = ?");
        $stmt->execute([$type, $value]);
        $profile = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$profile) {
            $default = $this->engine->getScore($type, $value);
            return [
                'trust_score' => $default,
                'trust_level' => ($default < 300) ? 'LOW' : (($default < 600) ? 'MEDIUM' : 'HIGH'),
                'last_updated_at' => null,
                'is_new' => true
            ];
        }
        return $profile;
    }

    public function getRecentEvents($type, $value, $limit = 10)
    {
        $stmt = $this->pdo->prepare("SELECT event_type, score_delta, reason, created_at FROM trust_score_events WHERE actor_type = ? AND actor_value = ? ORDER BY created_at DESC LIMIT ?");
        // Bind limit as int
        $stmt->bindValue(1, $type);
        $stmt->bindValue(2, $value);
        $stmt->bindValue(3, $limit, PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}
