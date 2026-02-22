<?php
// api/v4/media/cleanup_media.php
// Phase 5F: Attachment Expiry / Cache Purge Policy
// This script should be run periodically (e.g., daily cron) to clean up old media.

require_once __DIR__ . '/../../../api/db.php';
require_once __DIR__ . '/../../../api/audit_log.php';

// Configuration
$policy = [
    'expiry_days' => 30,           // Standard media expires after 30 days
    'temp_expiry_hours' => 24,     // Incomplete chunked uploads expire after 24 hours
    'max_logs' => 1000,            // Limit per run to avoid timeout
];

$uploadDir = realpath(__DIR__ . '/../../../api/uploads/');
$tempDir = realpath($uploadDir . '/temp/');

if (!$uploadDir || !is_dir($uploadDir)) {
    die("Invalid upload directory\n");
}

$now = time();
$deletedCount = 0;
$reclaimedBytes = 0;

try {
    // 1. Clean up stale standard media
    $files = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($uploadDir, RecursiveDirectoryIterator::SKIP_DOTS),
        RecursiveIteratorIterator::CHILD_FIRST
    );

    foreach ($files as $fileinfo) {
        $filePath = $fileinfo->getRealPath();

        // Skip directories and the temp folder itself (we'll handle it separately)
        if ($fileinfo->isDir() || strpos($filePath, $tempDir) === 0) {
            continue;
        }

        $ageSeconds = $now - $fileinfo->getMTime();
        if ($ageSeconds > ($policy['expiry_days'] * 86400)) {
            $size = $fileinfo->getSize();
            if (unlink($filePath)) {
                $deletedCount++;
                $reclaimedBytes += $size;
            }
        }
    }

    // 2. Clean up stale temp chunks (Phase 5E leftovers)
    if (is_dir($tempDir)) {
        $tempFiles = new DirectoryIterator($tempDir);
        foreach ($tempFiles as $file) {
            if ($file->isDot() || $file->isDir())
                continue;

            $ageSeconds = $now - $file->getMTime();
            if ($ageSeconds > ($policy['temp_expiry_hours'] * 3600)) {
                $size = $file->getSize();
                if (unlink($file->getRealPath())) {
                    $deletedCount++;
                    $reclaimedBytes += $size;
                }
            }
        }
    }

    // Audit Log the results
    auditLog('media_cleanup_summary', 'system', [
        'files_deleted' => $deletedCount,
        'reclaimed_mb' => round($reclaimedBytes / (1024 * 1024), 2),
        'policy' => $policy
    ]);

    echo json_encode([
        'status' => 'success',
        'deleted' => $deletedCount,
        'reclaimed_mb' => round($reclaimedBytes / (1024 * 1024), 2)
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
