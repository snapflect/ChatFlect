<?php
// cron/abuse_decay.php
// Epic 52 Hardening: Daily Abuse Score Decay
// Reduces cumulative scores by 50% (Half-Life) to allow redemption.

require_once __DIR__ . '/../includes/db_connect.php';

echo "Starting Abuse Score Decay...\n";

// 1. Decay Scores (Half-Life)
$pdo->exec("UPDATE abuse_scores SET score = FLOOR(score * 0.5)");
echo "[DECAY] All scores reduced by 50%.\n";

// 2. Cleanup Zero Scores
$stmtPrune = $pdo->exec("DELETE FROM abuse_scores WHERE score = 0");
echo "[PRUNE] Removed $stmtPrune clean records.\n";

echo "Decay Complete.\n";
