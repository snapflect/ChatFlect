<?php
// includes/audit_dashboard_access.php
// Helper for aggregating stats for SIEM/Dashboards

require_once __DIR__ . '/db_connect.php';

function getAuditStats($pdo)
{
    // Top 5 Attackers (IPs)
    $stmtIP = $pdo->query("
        SELECT ip_address, COUNT(*) as count 
        FROM security_audit_log 
        WHERE created_at > NOW() - INTERVAL 24 HOUR 
        GROUP BY ip_address 
        ORDER BY count DESC 
        LIMIT 5
    ");
    $topIPs = $stmtIP->fetchAll(PDO::FETCH_ASSOC);

    // Event Distribution
    $stmtEvents = $pdo->query("
        SELECT event_type, COUNT(*) as count 
        FROM security_audit_log 
        WHERE created_at > NOW() - INTERVAL 24 HOUR 
        GROUP BY event_type 
    ");
    $eventDist = $stmtEvents->fetchAll(PDO::FETCH_ASSOC);

    return [
        'generated_at' => date('c'),
        'top_ips_24h' => $topIPs,
        'event_types_24h' => $eventDist
    ];
}
