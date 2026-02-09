<?php
// includes/export_modules/device_registry.php

function getDeviceRegistry($pdo, $orgIdBin, $start, $end)
{
    // Current devices for org members
    $stmt = $pdo->prepare("
        SELECT d.device_id, d.device_name, d.trust_status, d.last_active, u.username
        FROM devices d
        JOIN users u ON d.user_id = u.id
        JOIN org_members m ON u.id = m.user_id
        WHERE m.org_id = ?
    ");
    // Improvements: Date range filtering on last_active or created_at if columns exist
    $stmt->execute([$orgIdBin]);
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}
