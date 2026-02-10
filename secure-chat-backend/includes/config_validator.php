<?php
// includes/config_validator.php
// Epic 36: Required Secrets Validation

require_once __DIR__ . '/env.php';

/**
 * Required secrets for backend operation.
 */
const REQUIRED_SECRETS = [
    'DB_HOST',
    'DB_USER',
    'DB_PASS',
    'DB_NAME',
    'ADMIN_API_TOKEN',
    'FIREBASE_PROJECT_ID'
];

/**
 * Optional secrets with recommended presence.
 */
const RECOMMENDED_SECRETS = [
    'FCM_SERVER_KEY',
    'GOOGLE_APPLICATION_CREDENTIALS'
];

/**
 * Validate all required secrets exist.
 * Returns array of missing keys, empty if all present.
 */
function validateRequiredSecrets(): array
{
    $missing = [];
    foreach (REQUIRED_SECRETS as $key) {
        $value = getenv($key);
        if ($value === false || $value === '') {
            $missing[] = $key;
        }
    }
    return $missing;
}

/**
 * Check recommended secrets.
 * Returns array of missing recommended keys.
 */
function checkRecommendedSecrets(): array
{
    $missing = [];
    foreach (RECOMMENDED_SECRETS as $key) {
        $value = getenv($key);
        if ($value === false || $value === '') {
            $missing[] = $key;
        }
    }
    return $missing;
}

/**
 * Fail-fast if required secrets missing.
 * Call this at application startup.
 */
function enforceRequiredSecrets(): void
{
    $missing = validateRequiredSecrets();
    if (!empty($missing)) {
        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode([
            'error' => 'SERVER_MISCONFIGURED',
            'message' => 'Required configuration is missing',
            'missing' => $missing
        ]);
        exit(1);
    }
}

/**
 * Get config summary (safe for logging).
 */
function getConfigSummary(): array
{
    return [
        'db_host_set' => getenv('DB_HOST') !== false,
        'firebase_project_set' => getenv('FIREBASE_PROJECT_ID') !== false,
        'admin_token_set' => getenv('ADMIN_API_TOKEN') !== false,
        'fcm_key_set' => getenv('FCM_SERVER_KEY') !== false,
        'app_env' => env('APP_ENV', 'production')
    ];
}
