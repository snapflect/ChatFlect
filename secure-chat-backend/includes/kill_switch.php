<?php
// includes/kill_switch.php
// Epic 30: Emergency Kill Switch Support

/**
 * Check if a feature is killed via environment variables.
 * Returns true if feature should be blocked.
 */
function isKilled($feature)
{
    $envKey = 'DISABLE_' . strtoupper($feature);
    $value = getenv($envKey);
    return $value === 'true' || $value === '1';
}

/**
 * Block request with 503 if feature is killed.
 */
function enforceKillSwitch($feature)
{
    if (isKilled($feature)) {
        require_once __DIR__ . '/logger.php';
        logWarn('KILL_SWITCH_BLOCKED', ['feature' => $feature]);

        http_response_code(503);
        header('Content-Type: application/json');
        header('Retry-After: 60');
        echo json_encode([
            'error' => 'SERVICE_UNAVAILABLE',
            'message' => 'Service temporarily disabled for maintenance',
            'feature' => $feature,
            'retry_after' => 60
        ]);
        exit;
    }
}

/**
 * Get all kill switch statuses.
 */
function getKillSwitchStatus()
{
    $features = ['SEND', 'PULL', 'REPAIR', 'PRESENCE', 'PUSH'];
    $status = [];
    foreach ($features as $f) {
        $status[$f] = isKilled($f);
    }
    return $status;
}
