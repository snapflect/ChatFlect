<?php
// cron/backup_cleanup.php
// Epic 73: Delete Expired Backups

require_once __DIR__ . '/../includes/db_connect.php';

try {
    $pdo->beginTransaction();

    // 1. Find Expired Job IDs
    $stmt = $pdo->prepare("SELECT job_id FROM backup_jobs WHERE expires_at < NOW()");
    $stmt->execute();
    $expiredIds = $stmt->fetchAll(PDO::FETCH_COLUMN);

    if (!empty($expiredIds)) {
        // 2. Delete Blobs
        $placeholders = implode(',', array_fill(0, count($expiredIds), '?'));

        $blobStmt = $pdo->prepare("DELETE FROM backup_blobs WHERE job_id IN ($placeholders)");
        $blobStmt->execute($expiredIds);

        // 3. Delete Jobs
        $jobStmt = $pdo->prepare("DELETE FROM backup_jobs WHERE job_id IN ($placeholders)");
        $jobStmt->execute($expiredIds);

        echo "Deleted " . count($expiredIds) . " expired backup jobs.\n";
    } else {
        echo "No expired backups found.\n";
    }

    $pdo->commit();
} catch (Exception $e) {
    $pdo->rollBack();
    echo "Error: " . $e->getMessage() . "\n";
}
