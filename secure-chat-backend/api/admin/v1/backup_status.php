<?php
// api/admin/v1/backup_status.php
// Epic 37: Backup Status Endpoint

require_once __DIR__ . '/../../../includes/admin_auth.php';

header('Content-Type: application/json');

try {
    $adminId = requireAdminAuth();

    $backupDir = __DIR__ . '/../../../backups';
    $lastBackupFile = "$backupDir/.last_backup.json";

    // Check if backup info exists
    if (!file_exists($lastBackupFile)) {
        echo json_encode([
            'success' => true,
            'status' => 'NO_BACKUP',
            'last_backup_at' => null,
            'message' => 'No backup found'
        ]);
        exit;
    }

    $lastBackup = json_decode(file_get_contents($lastBackupFile), true);
    $backupPath = "$backupDir/" . ($lastBackup['file'] ?? '');

    // Check backup age
    $backupTime = strtotime($lastBackup['timestamp'] ?? '');
    $ageHours = $backupTime ? (time() - $backupTime) / 3600 : 999;

    // Determine status
    $status = 'OK';
    if ($ageHours > 24) {
        $status = 'STALE';
    }
    if (!file_exists($backupPath)) {
        $status = 'MISSING';
    }

    // Count backups
    $backupCount = 0;
    if (is_dir($backupDir)) {
        $dirs = glob("$backupDir/*/", GLOB_ONLYDIR);
        $backupCount = count($dirs);
    }

    echo json_encode([
        'success' => true,
        'status' => $status,
        'last_backup_at' => $lastBackup['timestamp'] ?? null,
        'last_backup_size_mb' => $lastBackup['size_mb'] ?? 0,
        'last_backup_verified' => file_exists($backupPath),
        'backup_age_hours' => round($ageHours, 1),
        'backup_count' => $backupCount,
        'checksum' => $lastBackup['checksum_sha256'] ?? null
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'SERVER_ERROR', 'message' => $e->getMessage()]);
}
