<?php
// includes/env.php
// Epic 36: Centralized Environment Config Loader

/**
 * Get environment variable with optional default.
 */
function env(string $key, $default = null)
{
    $value = getenv($key);
    if ($value === false) {
        return $default;
    }

    // Handle boolean strings
    if (strtolower($value) === 'true')
        return true;
    if (strtolower($value) === 'false')
        return false;

    // Handle numeric strings
    if (is_numeric($value)) {
        return strpos($value, '.') !== false ? (float) $value : (int) $value;
    }

    return $value;
}

/**
 * Require environment variable (fail if missing).
 */
function envRequired(string $key)
{
    $value = getenv($key);
    if ($value === false || $value === '') {
        throw new RuntimeException("Missing required env: $key");
    }
    return $value;
}

/**
 * Load .env file if exists (dev only).
 */
function loadEnvFile(string $path = null)
{
    $path = $path ?: __DIR__ . '/../config/.env';
    if (!file_exists($path)) {
        return false;
    }

    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0)
            continue;
        if (strpos($line, '=') === false)
            continue;

        list($key, $value) = explode('=', $line, 2);
        $key = trim($key);
        $value = trim($value, " \t\n\r\0\x0B\"'");

        if (!getenv($key)) {
            putenv("$key=$value");
        }
    }
    return true;
}

// Auto-load .env in dev
if (env('APP_ENV', 'production') !== 'production') {
    loadEnvFile();
}
