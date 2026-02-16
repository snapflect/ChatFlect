<?php
// includes/secrets_manager.php
// Epic 91: Unified Secrets Management

class SecretsManager
{
    /**
     * Get a secret by key.
     * Priority:
     * 1. Docker Secret File (/run/secrets/{key})
     * 2. Environment Variable ({KEY})
     * 3. Default Value (Optional)
     */
    public static function get(string $key, $default = null)
    {
        // 1. Docker Secret (Production Standard)
        $secretFile = "/run/secrets/$key";
        if (file_exists($secretFile) && is_readable($secretFile)) {
            $secret = trim(file_get_contents($secretFile));
            if (!empty($secret)) {
                return $secret;
            }
        }

        // 2. Environment Variable (12-Factor App)
        // Normalize key to UPPERCASE
        $envKey = strtoupper($key);
        $envVal = getenv($envKey);
        if ($envVal !== false && $envVal !== '') {
            return $envVal;
        }

        // 3. Superglobal ENV (Fallback)
        if (isset($_ENV[$envKey])) {
            return $_ENV[$envKey];
        }

        // 4. Hostinger/Shared Hosting Fallback: Parse .env directly
        // Because getenv() often fails if phpdotenv isn't fully integrated or blocked.
        $envPath = __DIR__ . '/../.env';
        if (file_exists($envPath)) {
            $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            foreach ($lines as $line) {
                if (strpos(trim($line), '#') === 0)
                    continue;
                list($name, $value) = explode('=', $line, 2) + [NULL, NULL];
                if ($name && trim($name) === $envKey) {
                    return trim($value);
                }
            }
        }

        // 4. Hostinger/Shared Hosting Fallback: Parse .env directly
        // Because getenv() often fails if phpdotenv isn't fully integrated or blocked.
        $envPath = __DIR__ . '/../.env';
        if (file_exists($envPath)) {
            $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            foreach ($lines as $line) {
                if (strpos(trim($line), '#') === 0)
                    continue;
                list($name, $value) = explode('=', $line, 2) + [NULL, NULL];
                if ($name && trim($name) === $envKey) {
                    return trim($value);
                }
            }
        }

        return $default;
    }
}
