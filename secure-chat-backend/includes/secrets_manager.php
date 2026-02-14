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

        return $default;
    }
}
