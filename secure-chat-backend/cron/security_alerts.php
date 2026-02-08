<?php
// cron/security_alerts.php
// Scans audit log for anomaly patterns (Brute Force, Tampering)
// Intended to run every 5 minutes.

require_once __DIR__ . '/../includes/db_connect.php';
require_once __DIR__ . '/../includes/audit_logger.php';

$logger = new AuditLogger($pdo);

echo "Starting Security Scan...\n";

// Rule 1: High Decryption Failure Rate (Potential Tampering/Key Rotation Issue)
$stmt = $pdo->query("
    SELECT device_id, COUNT(*) as fail_count 
    FROM security_audit_log 
    WHERE event_type = 'DECRYPT_FAIL' 
      AND created_at > NOW() - INTERVAL 5 MINUTE 
    GROUP BY device_id 
    HAVING fail_count > 10
");

while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    $devId = $row['device_id'];
    $count = $row['fail_count'];
    echo "[ALERT] Device $devId has $count decryption failures.\n";
    $logger->log('ALERT_HIGH_DECRYPT_FAIL', 'CRITICAL', [
        'device_id' => $devId,
        'meta' => ['count' => $count]
    ]);
}

// Rule 2: Sync Abuse (Rate Limit Hits)
$stmt = $pdo->query("
    SELECT device_id, COUNT(*) as hit_count 
    FROM security_audit_log 
    WHERE event_type = 'SYNC_RATE_LIMIT' 
      AND created_at > NOW() - INTERVAL 5 MINUTE 
    GROUP BY device_id 
    HAVING hit_count > 20
");

while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    $devId = $row['device_id'];
    $count = $row['hit_count'];
    echo "[ALERT] Device $devId sync abuse ($count hits).\n";
    $logger->log('ALERT_SYNC_ABUSE', 'WARNING', [
        'device_id' => $devId,
        'meta' => ['count' => $count]
    ]);
}

// HF-51.4: Statistical Anomaly Detection
// Detect sudden spikes comparing current hour vs 24h average
$events = ['DECRYPT_FAIL', 'DEVICE_REVOKED', 'AUTH_FAIL'];

foreach ($events as $evt) {
    // 1. Avg per hour (last 24h)
    $stmtAvg = $pdo->prepare("
        SELECT COUNT(*) / 24 
        FROM security_audit_log 
        WHERE event_type = ? AND created_at > NOW() - INTERVAL 24 HOUR
    ");
    $stmtAvg->execute([$evt]);
    $avg = $stmtAvg->fetchColumn();

    // 2. Current Hour
    $stmtCurr = $pdo->prepare("
        SELECT COUNT(*) 
        FROM security_audit_log 
        WHERE event_type = ? AND created_at > NOW() - INTERVAL 1 HOUR
    ");
    $stmtCurr->execute([$evt]);
    $curr = $stmtCurr->fetchColumn();

    // Threshold: 3x Average + Min Noise Floor (10)
    $threshold = max($avg * 3, 10);

    if ($curr > $threshold) {
        echo "[ALERT] Anomaly Detected: $evt spike ($curr vs avg $avg).\n";
        $logger->log('ALERT_ANOMALY_SPIKE', 'WARNING', [
            'event' => $evt,
            'current' => $curr,
            'avg' => $avg
        ]);
    }
}

echo "Scan Complete.\n";
