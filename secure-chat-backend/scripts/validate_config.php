<?php
// scripts/validate_config.php
// Epic 96: Fail-Fast Config Validator

require_once __DIR__ . '/../includes/secrets_manager.php';

$errors = [];
$config = [];

// 1. Secrets Check
$requiredSecrets = [
    'DB_HOST',
    'DB_NAME',
    'DB_USER',
    'DB_PASSWORD',
    'JWT_SECRET',
    'ENCRYPTION_KEY'
];

foreach ($requiredSecrets as $key) {
    $val = SecretsManager::get($key);
    if ($val === null || trim($val) === '') {
        $errors[] = "Missing critical secret: $key";
    } else {
        $config[$key] = '[REDACTED]';
    }
}

// 2. Metrics Token
if (!SecretsManager::get('METRICS_TOKEN')) {
    $errors[] = "Missing METRICS_TOKEN. Observability unsupported.";
}

// 3. SSO Validation
if (getenv('FEATURE_SSO_ENABLED') === 'true') {
    $oidcVars = ['OIDC_CLIENT_ID', 'OIDC_CLIENT_SECRET', 'OIDC_ISSUER'];
    foreach ($oidcVars as $var) {
        if (!getenv($var) && !SecretsManager::get($var)) {
            $errors[] = "SSO Enabled but missing: $var";
        }
    }
}

// Output
$output = [
    'timestamp' => date('c'),
    'status' => empty($errors) ? 'OK' : 'CRITICAL_FAILURE',
    'errors' => $errors,
    'config_summary' => $config
];

echo json_encode($output, JSON_PRETTY_PRINT) . PHP_EOL;

if (!empty($errors)) {
    exit(1);
}
exit(0);
