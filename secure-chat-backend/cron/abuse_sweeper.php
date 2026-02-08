<?php
// cron/abuse_sweeper.php
// Epic 52: Cleans up expired rate limit buckets and bans

require_once __DIR__ . '/../includes/db_connect.php';

echo "Starting Abuse Cleanup...\n";

// 1. Clean Buckets
$stmtBucket = $pdo->query("DELETE FROM rate_limit_buckets WHERE expires_at < NOW()");
echo "[BUCKETS] Cleared " . $stmtBucket->rowCount() . " expired buckets.\n";

// 2. Clean Banlist (Soft delete or archive in real recurring logic, here just prune expired)
// Ops choice: Keep history or prune? Let's prune expired bans > 7 days old to keep table light
$stmtBan = $pdo->query("DELETE FROM ip_banlist WHERE expires_at < NOW() - INTERVAL 7 DAY");
echo "[BANS] Pruned " . $stmtBan->rowCount() . " old bans.\n";

echo "Abuse Sweep Complete.\n";
