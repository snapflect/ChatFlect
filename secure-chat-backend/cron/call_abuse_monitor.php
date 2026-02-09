<?php
// cron/call_abuse_monitor.php
// Epic 77: Detect Join Spam

require_once __DIR__ . '/../includes/db_connect.php';

// Check for devices with > 50 failed joins in last hour
$stmt = $pdo->prepare("
    SELECT user_id, device_id, COUNT(*) as failures 
    FROM call_audit_logs 
    WHERE action = 'JOIN_FAILED' AND created_at > NOW() - INTERVAL 1 HOUR 
    GROUP BY user_id, device_id 
    HAVING failures > 50
");
$stmt->execute();

while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    echo "Flagging Device: {$row['device_id']} (User {$row['user_id']}) - {$row['failures']} failures\n";
    // Reduce Trust Score (Mock)
    // $trustManager->penalize($row['user_id'], $row['device_id']);

    // Log Moderation Event
    $modId = 0; // System
    $callId = str_repeat("\0", 32); // NULL Call ID for global flag

    // Insert into moderation logs... (Simplified)
}
