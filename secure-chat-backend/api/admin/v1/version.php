<?php
// api/admin/v1/version.php
// Epic 38: Deployment Version Endpoint

require_once __DIR__ . '/../../../includes/admin_auth.php';

header('Content-Type: application/json');

try {
    $adminId = requireAdminAuth();

    $manifestPath = __DIR__ . '/../../../deployments/current.json';

    if (!file_exists($manifestPath)) {
        // Fallback: get from git
        $commit = trim(shell_exec('git rev-parse HEAD 2>/dev/null') ?? '');
        $commitShort = trim(shell_exec('git rev-parse --short HEAD 2>/dev/null') ?? '');

        echo json_encode([
            'success' => true,
            'commit' => $commit ?: 'unknown',
            'commit_short' => $commitShort ?: 'unknown',
            'env' => env('APP_ENV', 'unknown'),
            'deployed_at' => null,
            'source' => 'git'
        ]);
        exit;
    }

    $manifest = json_decode(file_get_contents($manifestPath), true);

    echo json_encode([
        'success' => true,
        'commit' => $manifest['commit'] ?? 'unknown',
        'commit_short' => $manifest['commit_short'] ?? 'unknown',
        'env' => $manifest['env'] ?? env('APP_ENV', 'unknown'),
        'deployed_at' => $manifest['deployed_at'] ?? null,
        'deployed_by' => $manifest['deployed_by'] ?? null,
        'source' => 'manifest'
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'SERVER_ERROR', 'message' => $e->getMessage()]);
}
