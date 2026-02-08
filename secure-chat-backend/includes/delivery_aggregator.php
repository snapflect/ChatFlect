<?php
// includes/delivery_aggregator.php
// Epic 49: User-Level Delivery Aggregation

require_once __DIR__ . '/db_connect.php';

function getMessageDeliveryStatus($pdo, $messageUuid)
{
    // 1. Count Total Trusted Devices for Recipient (Snapshot at send time ideally, but current count is proxy)
    // Actually, we can just count rows in device_inbox for this messageUuid

    // HF-49.5: Trust Filtering
    // Only count devices that are currently TRUSTED. 
    // Revoked devices should not count towards "Delivered" state (prevents compromised device from faking delivery)

    $stmt = $pdo->prepare("
        SELECT 
            COUNT(di.recipient_device_id) as total_devices,
            SUM(CASE WHEN di.status = 'DELIVERED' THEN 1 ELSE 0 END) as delivered_count,
            SUM(CASE WHEN di.status = 'ACKED' THEN 1 ELSE 0 END) as acked_count,
            SUM(CASE WHEN di.status = 'READ' THEN 1 ELSE 0 END) as read_count
        FROM device_inbox di
        JOIN devices d ON di.recipient_device_id = d.device_id
        WHERE di.message_uuid = ? AND d.trust_state = 'TRUSTED'
    ");
    $stmt->execute([$messageUuid]);
    $stats = $stmt->fetch(PDO::FETCH_ASSOC);

    $total = $stats['total_devices'];

    if ($total == 0)
        return 'UNKNOWN'; // Should not happen if fanout worked

    // User-Level Logic:
    // READ if ANY device read it? Or ALL?
    // Signal/WhatsApp: "Read" if ANY device sent read receipt.
    // "Delivered" if ALL (or ANY? Usually ANY is enough to show checkmark)

    if ($stats['read_count'] > 0)
        return 'READ';
    if ($stats['acked_count'] > 0)
        return 'DELIVERED'; // Acked = Processed
    if ($stats['delivered_count'] > 0)
        return 'DELIVERED'; // Delivered = Pulled

    return 'SENT'; // Queued
}
