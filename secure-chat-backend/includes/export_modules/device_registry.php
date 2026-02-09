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
    // HF-63.4: Redaction
    $redaction = $job['redaction_level'] ?? 'PARTIAL';

    // If STRICT redaction, don't show device_name or last active specifics? 
    // Or just mask if user requested.
    // For now, let's assume 'PARTIAL' masks IP if we had it.
    // Since we don't return IP in this query, let's say we mask 'device_name' if STRICT.

    $data = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if ($redaction === 'STRICT') {
        foreach ($data as &$row) {
            $row['device_name'] = 'REDACTED_DEVICE';
        }
    }

    return $data;
}
