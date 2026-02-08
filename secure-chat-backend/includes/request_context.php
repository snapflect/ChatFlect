<?php
// includes/request_context.php
// Epic 28: Request Context + Correlation ID Management

/**
 * Global request context for correlation ID tracking.
 */
class RequestContext
{
    private static $requestId = null;
    private static $userId = null;
    private static $deviceUuid = null;
    private static $startTime = null;
    private static $endpoint = null;

    /**
     * Initialize request context (call early in request lifecycle).
     */
    public static function init()
    {
        self::$startTime = microtime(true);
        self::$endpoint = $_SERVER['REQUEST_URI'] ?? 'unknown';

        // Get or generate request ID
        $providedId = $_SERVER['HTTP_X_REQUEST_ID'] ?? null;
        self::$requestId = $providedId ?: self::generateRequestId();

        // Set response header immediately
        header('X-Request-ID: ' . self::$requestId);
    }

    /**
     * Generate UUIDv4 request ID.
     */
    private static function generateRequestId()
    {
        return sprintf(
            '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000,
            mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff)
        );
    }

    public static function getRequestId()
    {
        if (self::$requestId === null) {
            self::init();
        }
        return self::$requestId;
    }

    public static function setUser($userId, $deviceUuid = null)
    {
        self::$userId = $userId;
        self::$deviceUuid = $deviceUuid;
    }

    public static function getUserId()
    {
        return self::$userId;
    }
    public static function getDeviceUuid()
    {
        return self::$deviceUuid;
    }
    public static function getEndpoint()
    {
        return self::$endpoint;
    }

    public static function getElapsedMs()
    {
        if (self::$startTime === null)
            return 0;
        return round((microtime(true) - self::$startTime) * 1000, 2);
    }

    public static function getContext()
    {
        return [
            'request_id' => self::getRequestId(),
            'user_id' => self::$userId,
            'device_uuid' => self::$deviceUuid,
            'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
            'endpoint' => self::$endpoint
        ];
    }
}

// Auto-init on include
RequestContext::init();
