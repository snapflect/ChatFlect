<?php
// api/v4/security/report_spoof.php
// HF-5D.8: Auto Session Lockdown
// When a client detects a spoofed device (inner _duid != outer senderDeviceUuid),
// it reports here. The backend marks the device as 'suspicious' and logs the event.

require_once __DIR__ . '/../../../api/auth_middleware.php';

$user = requireAuth();
$input = json_decode(file_get_contents('php://input'), true);

try {
    $spoofedSenderId = $input['spoofed_sender_id'] ?? null;
    $outerUuid = $input['outer_device_uuid'] ?? null;
    $innerUuid = $input['inner_device_uuid'] ?? null;
    $context = $input['context'] ?? 'unknown';
    $reporterUuid = $input['reporter_device_uuid'] ?? null;

    if (!$spoofedSenderId || !$outerUuid) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing required fields']);
        exit;
    }

    // 1. Log the security event
    $stmt = $pdo->prepare("INSERT INTO security_events (event_type, user_id, device_uuid, details, created_at) VALUES (?, ?, ?, ?, NOW())");
    $stmt->execute([
        'SPOOF_REPORT',
        $spoofedSenderId,
        $outerUuid,
        json_encode([
            'inner_uuid' => $innerUuid,
            'outer_uuid' => $outerUuid,
            'context' => $context,
            'reporter_user' => $user['user_id'],
            'reporter_device' => $reporterUuid
        ])
    ]);

    // 2. Mark the outer device UUID as suspicious (if it exists)
    // This prevents the spoofed device from sending further messages
    $stmtLock = $pdo->prepare("UPDATE user_devices SET trust_status = 'suspicious' WHERE device_uuid = ?");
    $stmtLock->execute([$outerUuid]);
    $affectedOuter = $stmtLock->rowCount();

    // 3. Also mark the inner UUID if different (attacker's real device)
    if ($innerUuid && $innerUuid !== $outerUuid) {
        $stmtLock->execute([$innerUuid]);
    }

    // 4. Check for repeated spoof attempts (escalation trigger)
    $stmtCount = $pdo->prepare("SELECT COUNT(*) as cnt FROM security_events WHERE event_type IN ('SPOOF_REPORT', 'DEVICE_SPOOF') AND device_uuid = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)");
    $stmtCount->execute([$outerUuid]);
    $count = $stmtCount->fetch(PDO::FETCH_ASSOC)['cnt'];

    if ($count >= 3) {
        // Escalate: Log a SESSION_LOCKDOWN event
        $pdo->prepare("INSERT INTO security_events (event_type, user_id, device_uuid, details, created_at) VALUES (?, ?, ?, ?, NOW())")
            ->execute(['SESSION_LOCKDOWN', $spoofedSenderId, $outerUuid, "Auto-lockdown after {$count} spoof reports in 1 hour"]);
    }

    echo json_encode([
        'success' => true,
        'locked_devices' => $affectedOuter,
        'spoof_count_1h' => (int) $count
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
