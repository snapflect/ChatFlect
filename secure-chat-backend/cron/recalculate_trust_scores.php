<?php
// cron/recalculate_trust_scores.php
// Epic 55: Daily Trust Score Recalculation
// Applies decay to older events (or bonus for clean days).

require_once __DIR__ . '/../includes/db_connect.php';
require_once __DIR__ . '/../includes/trust_score_engine.php';

echo "Starting Trust Score Recalculation...\n";

$engine = new TrustScoreEngine($pdo);

// 1. Reward Clean Users (Simplified)
// Find users active in last 24h with NO negative events
// For standard SQL, complex.
// Iteration 1: Just apply 'CLEAN_DAY' bonus to everyone active yesterday who didn't get a penalty.
// Optimization: We'll stick to Reacting to Events for now + Decay.

// 2. Score Normalization (Optional Decay upwards/downwards to center?)
// Strategy: "Clean Day" bonus.
// We should query audit logs for activity? 
// For this MVP: We won't auto-award points blindly.
// Instead, we ensure consistency or clean up old events.

// REAL IMPLEMENTATION (Phase 10):
// Iterate over all actors with activity in last 24h.
// Check if they had violations. If not, $engine->logEvent(..., 'CLEAN_DAY');

$yesterday = date('Y-m-d', strtotime('-1 day'));

// Find active users from audit logs
$stmt = $pdo->prepare("SELECT DISTINCT user_id FROM security_audit_log WHERE created_at >= ? AND user_id IS NOT NULL");
$stmt->execute([$yesterday]);
$activeUsers = $stmt->fetchAll(PDO::FETCH_COLUMN);

echo "Found " . count($activeUsers) . " active users.\n";

foreach ($activeUsers as $uid) {
    // Check for negative events
    $stmtBad = $pdo->prepare("SELECT 1 FROM trust_score_events WHERE actor_type = 'USER' AND actor_value = ? AND created_at >= ? AND score_delta < 0 LIMIT 1");
    $stmtBad->execute([$uid, $yesterday]);

    if (!$stmtBad->fetchColumn()) {
        // Clean day!
        $engine->logEvent('USER', $uid, 'CLEAN_DAY', 'No violations on ' . $yesterday);
        echo "Awarded CLEAN_DAY to User $uid\n";
    }
}

echo "Trust Score Recalculation Complete.\n";
