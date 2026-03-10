<?php
// cleanup_status.php
require 'db.php';

// Phase 6: Automated Pruning
// Delete statuses where created_at < NOW() - INTERVAL 25 HOUR
// Ensure deletions happen in transactional batches (e.g., LIMIT 100)

echo "Starting Status Cleanup...\n";

$batchSize = 100;
$totalDeleted = 0;
$totalMediaUnlinked = 0;

while (true) {
    // 1. Select a batch of expired statuses
    $stmt = $conn->prepare("SELECT id, media_url FROM status_updates WHERE created_at < NOW() - INTERVAL 25 HOUR LIMIT ?");
    $stmt->bind_param("i", $batchSize);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 0) {
        break; // No more expired statuses
    }

    $idsToDelete = [];
    while ($row = $result->fetch_assoc()) {
        $idsToDelete[] = $row['id'];

        // Phase 6: Safe unlink
        if (!empty($row['media_url'])) {
            $path = realpath(__DIR__ . '/' . str_replace('serve.php?file=', '', $row['media_url']));
            if ($path && strpos($path, realpath(__DIR__ . '/uploads')) === 0 && file_exists($path)) {
                @unlink($path);
                $totalMediaUnlinked++;
            }
        }
    }
    $stmt->close();

    // 2. Delete the batch
    if (count($idsToDelete) > 0) {
        $placeholders = implode(',', array_fill(0, count($idsToDelete), '?'));
        $types = str_repeat('i', count($idsToDelete));

        $deleteStmt = $conn->prepare("DELETE FROM status_updates WHERE id IN ($placeholders)");
        $deleteStmt->bind_param($types, ...$idsToDelete);
        $deleteStmt->execute();
        $deleted = $deleteStmt->affected_rows;
        $totalDeleted += $deleted;
        $deleteStmt->close();
    }

    // Sleep briefly to prevent table locks and CPU spikes
    usleep(50000); // 50ms
}

echo "Cleanup Complete.\n";
echo "Deleted Statuses: $totalDeleted\n";
echo "Media Files Unlinked: $totalMediaUnlinked\n";
?>