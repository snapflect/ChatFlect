<?php
// process_push_queue.php
// Push Queue Background Worker (Phase 2)
require 'db.php';
require __DIR__ . '/vendor/autoload.php';

echo "Push Worker Started...\n";

// Ensure push_queue table has 'recipient_id' if we want to fan out, 
// OR we fan out internally here since the table only stores 'sender_id'.
// We fan out here to preserve disk space and upload speed.

$stmt = $conn->prepare("SELECT id, sender_id, payload FROM push_queue WHERE status = 'pending' AND action_type = 'NEW_STATUS' AND retry_count < 3 LIMIT 50");
$stmt->execute();
$queueResult = $stmt->get_result();

$processIds = [];
$updatesData = [];

while ($row = $queueResult->fetch_assoc()) {
    $processIds[] = $row['id'];
    $updatesData[] = $row;
}
$stmt->close();

if (count($processIds) === 0) {
    echo "Queue empty.\n";
    exit;
}

// Mark as processing
$placeholders = implode(',', array_fill(0, count($processIds), '?'));
$types = str_repeat('i', count($processIds));
$updateStmt = $conn->prepare("UPDATE push_queue SET status = 'processing' WHERE id IN ($placeholders)");
$updateStmt->bind_param($types, ...$processIds);
$updateStmt->execute();
$updateStmt->close();

foreach ($updatesData as $job) {
    $senderId = $job['sender_id'];
    $jobId = $job['id'];

    // Privacy Enforcement: Find all contacts who have this sender,
    // AND haven't blocked the sender.
    // (Muted users still receive pushes silently, handled by client/payload).

    // Basic query assuming a 'contacts' or standard 'users' fan out
    $recipientStmt = $conn->prepare("
        SELECT DISTINCT d.push_token 
        FROM user_devices d
        JOIN users u ON d.user_id = u.user_id
        WHERE d.push_token IS NOT NULL 
        AND d.status = 'active'
        AND d.user_id != ?
        AND d.user_id NOT IN (
            SELECT user_id FROM block_list WHERE blocked_user_id = ?
        )
    ");
    $recipientStmt->bind_param("ss", $senderId, $senderId);
    $recipientStmt->execute();
    $recipientsResult = $recipientStmt->get_result();

    $tokens = [];
    while ($r = $recipientsResult->fetch_assoc()) {
        $tokens[] = $r['push_token'];
    }
    $recipientStmt->close();

    if (count($tokens) > 0) {
        // Here you would integrate FCM or APNs using $tokens
        // e.g., sendFCM($tokens, ['type' => 'NEW_STATUS']);
        echo "Fan out from Job $jobId to " . count($tokens) . " tokens.\n";
    }

    // Mark complete
    $compStmt = $conn->prepare("UPDATE push_queue SET status = 'completed' WHERE id = ?");
    $compStmt->bind_param("i", $jobId);
    $compStmt->execute();
    $compStmt->close();
}

echo "Processed " . count($updatesData) . " jobs.\n";
?>