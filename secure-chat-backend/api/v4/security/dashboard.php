<?php
// api/v4/security/dashboard.php
// SIEM Aggegation Endpoint (HF-51.6)
// Provides JSON metrics for 24h / 7d trends

require_once __DIR__ . '/../../../includes/db_connect.php';
require_once __DIR__ . '/../../../includes/env.php';

header('Content-Type: application/json');

// 1. Admin Auth
$headers = getallheaders();
$adminSecret = getenv('ADMIN_SECRET_KEY');
$receivedSecret = $headers['X-Admin-Secret'] ?? '';

if (!$adminSecret || $receivedSecret !== $adminSecret) {
    http_response_code(403);
    echo json_encode(['error' => 'FORBIDDEN']);
    exit;
}

// 2. Aggregations
$metrics = [];

// 2a. Last 24h Counts by Type
$stmt24h = $pdo->query("
    SELECT event_type, COUNT(*) as count 
    FROM security_audit_log 
    WHERE created_at > NOW() - INTERVAL 24 HOUR 
    GROUP BY event_type
");
$metrics['last_24h'] = $stmt24h->fetchAll(PDO::FETCH_ASSOC);

// 2b. Last 7d Trend (Daily Buckets)
$stmt7d = $pdo->query("
    SELECT DATE(created_at) as date, event_type, COUNT(*) as count
    FROM security_audit_log
    WHERE created_at > NOW() - INTERVAL 7 DAY
    GROUP BY DATE(created_at), event_type
    ORDER BY date ASC
");
$metrics['trend_7d'] = $stmt7d->fetchAll(PDO::FETCH_ASSOC);

// 2c. Top 5 Attackers (IP)
// HF-51.9: Secure Output - Mask IPs by default unless 'raw=true'
$isRaw = isset($_GET['raw']) && $_GET['raw'] === 'true';

$stmtIP = $pdo->query("
    SELECT ip_address, COUNT(*) as count 
    FROM security_audit_log 
    WHERE created_at > NOW() - INTERVAL 24 HOUR 
    GROUP BY ip_address 
    ORDER BY count DESC 
    LIMIT 5
");
$metrics['top_ips'] = array_map(function($row) use ($isRaw) {
    if (!$isRaw) {
        $row['ip_address'] = substr($row['ip_address'], 0, 4) . '.xx.xx.xx'; // Masked
    }
    return $row;
}, $stmtIP->fetchAll(PDO::FETCH_ASSOC));


echo json_encode(['success' => true, 'generated_at' => date('c'), 'metrics' => $metrics]);
