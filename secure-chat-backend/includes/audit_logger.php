<?php
// includes/audit_logger.php
// Centralized Security Logging Utility

class AuditLogger
{
    private $pdo;

    public function __construct($pdo)
    {
        $this->pdo = $pdo;
    }

    /**
     * Log a security event.
     * 
     * @param string $eventType e.g., 'AUTH_FAIL', 'DECRYPT_ERROR'
     * @param string $severity 'INFO', 'WARNING', 'CRITICAL'
     * @param array $context ['user_id' => 1, 'device_id' => '...', 'ip' => '...', 'meta' => []]
     */
    public function log($eventType, $severity, $context = [])
    {
        try {
            $stmt = $this->pdo->prepare("
                INSERT INTO security_audit_log 
                (event_type, severity, user_id, device_id, ip_address, metadata)
                VALUES (?, ?, ?, ?, ?, ?)
            ");

            $userId = $context['user_id'] ?? null;
            $deviceId = $context['device_id'] ?? null;
            $ip = $context['ip'] ?? $_SERVER['REMOTE_ADDR'] ?? null;
            $meta = isset($context['meta']) ? json_encode($context['meta']) : null;

            $stmt->execute([$eventType, $severity, $userId, $deviceId, $ip, $meta]);

            // HF-51.3: External SIEM Forwarding
            // Forward CRITICAL events to Syslog (consumed by Splunk/Datadog agent)
            if ($severity === 'CRITICAL' || $severity === 'BLOCKER') {
                openlog("ChatFlectSecurity", LOG_PID | LOG_PERROR, LOG_USER);
                syslog(LOG_CRIT, json_encode([
                    'evt' => $eventType,
                    'uid' => $userId,
                    'dev' => $deviceId,
                    'meta' => $context
                ]));
                closelog();
            }

        } catch (Exception $e) {
            // Fallback to system error log if DB audit fails (Critical fail-safe)
            error_log("[AUDIT FAILURE] Could not log event $eventType: " . $e->getMessage());
        }
    }
}
