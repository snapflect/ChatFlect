<?php
// includes/export_modules/audit_feed.php

function getAuditFeed($pdo, $orgIdBin, $start, $end)
{
    // Cap at 10,000 for safety as per requirements
    // Mock query logic (Simulated org_id tagging)
    $stmt = $pdo->prepare("
        SELECT log_id, event_type, user_id, resource_id, metadata, created_at 
        FROM audit_logs 
        WHERE (resource_id = ? OR metadata LIKE ?)
        AND created_at BETWEEN ? AND ?
        ORDER BY log_id ASC
        LIMIT 10000
    ");
    $orgIdHex = bin2hex($orgIdBin);
    $metaParam = '%"org_id":"' . $orgIdHex . '"%';

    $stmt->execute([$orgIdHex, $metaParam, $start, $end]);
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}
