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

// HF-55.2: Trust Decay for Dormant Accounts
// Decay 5 points if last_seen > 90 days
// We need 'last_seen'. Using audit log last event?
// This is expensive on large scale.
// Using simplified logic: If NOT in activeUsers (last 24h), we check last activity?
// For patch: Let's iterate trust_scores table where last_updated < 90 days ago? 
// No, decay applies to HIGH scores that go dormant.
// Let's implement active user reward (Anti-Farming) first.

// HF-55.5: Anti-Farming Rule
// "Clean Day" only if they actually decrypted messages?
// This requires querying `decryption_logs` or similar. 
// We defined `security_audit_log` with event_type 'MSG_DECRYPT_SUCCESS' in Epic 51?
// Let's assume we look for 'MSG_DECRYPT_SUCCESS' or 'MSG_SENT'.

foreach ($activeUsers as $uid) {
    // 1. Check for meaningful activity (HF-55.5)
    $stmtAct = $pdo->prepare("SELECT 1 FROM security_audit_log WHERE user_id = ? AND created_at >= ? AND event_type IN ('MSG_DECRYPT_SUCCESS', 'MSG_SENT') LIMIT 1");
    $stmtAct->execute([$uid, $yesterday]);
    if (!$stmtAct->fetchColumn()) {
        // Active but no real messages? Passive farming? Skip bonus.
        echo "Skip User $uid: No meaningful activity.\n";
        continue;
    }

    // 2. Check for negative events
    $stmtBad = $pdo->prepare("SELECT 1 FROM trust_score_events WHERE actor_type = 'USER' AND actor_value = ? AND created_at >= ? AND score_delta < 0 LIMIT 1");
    $stmtBad->execute([$uid, $yesterday]);

    if (!$stmtBad->fetchColumn()) {
        $engine->logEvent('USER', $uid, 'CLEAN_DAY', 'Active & Clean on ' . $yesterday);
        echo "Awarded CLEAN_DAY to User $uid\n";
    }
}

// HF-55.2: Decay Dormant
// Find users with Score > 400 who haven't updated in 90 days
$ninetyDaysAgo = date('Y-m-d', strtotime('-90 days'));
$stmtDormant = $pdo->prepare("SELECT actor_type, actor_value FROM trust_scores WHERE trust_score > 400 AND last_updated_at < ?");
$stmtDormant->execute([$ninetyDaysAgo]);
while ($row = $stmtDormant->fetch(PDO::FETCH_ASSOC)) {
    $engine->logEvent($row['actor_type'], $row['actor_value'], 'DECAY_INACTIVITY', 'Dormant > 90 days');
    echo "Decayed dormant actor " . $row['actor_value'] . "\n";
}


echo "Trust Score Recalculation Complete.\n";
