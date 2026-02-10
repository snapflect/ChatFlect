<?php
// includes/logger.php
// Epic 28: Structured Logging Framework

require_once __DIR__ . '/request_context.php';

/**
 * Structured Logger - JSON Lines format.
 */
class Logger
{
    private static $logFile = null;

    private static function getLogFile()
    {
        if (self::$logFile === null) {
            $logDir = __DIR__ . '/../logs';
            if (!is_dir($logDir)) {
                @mkdir($logDir, 0755, true);
            }
            self::$logFile = $logDir . '/app.log';
        }
        return self::$logFile;
    }

    private static function write($level, $event, $data = [])
    {
        $entry = [
            'ts' => gmdate('Y-m-d\TH:i:s\Z'),
            'level' => $level,
            'request_id' => RequestContext::getRequestId(),
            'user_id' => RequestContext::getUserId(),
            'device_uuid' => RequestContext::getDeviceUuid(),
            'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
            'endpoint' => RequestContext::getEndpoint(),
            'event' => $event
        ];

        if (!empty($data)) {
            $entry['data'] = $data;
        }

        $json = json_encode($entry, JSON_UNESCAPED_SLASHES);
        @file_put_contents(self::getLogFile(), $json . "\n", FILE_APPEND | LOCK_EX);

        // Also log to error_log for immediate visibility
        error_log("[$level] $event | rid:" . RequestContext::getRequestId());
    }

    public static function info($event, $data = [])
    {
        self::write('INFO', $event, $data);
    }

    public static function warn($event, $data = [])
    {
        self::write('WARN', $event, $data);
    }

    public static function error($event, $data = [])
    {
        self::write('ERROR', $event, $data);
    }

    public static function perf($event, $ms, $data = [])
    {
        $data['duration_ms'] = $ms;
        self::write('PERF', $event, $data);
    }

    public static function security($event, $data = [])
    {
        self::write('SECURITY', $event, $data);
    }
}

// Convenience functions
function logInfo($event, $data = [])
{
    Logger::info($event, $data);
}
function logWarn($event, $data = [])
{
    Logger::warn($event, $data);
}
function logError($event, $data = [])
{
    Logger::error($event, $data);
}
function logPerf($event, $ms, $data = [])
{
    Logger::perf($event, $ms, $data);
}
function logSecurity($event, $data = [])
{
    Logger::security($event, $data);
}
function getRequestId()
{
    return RequestContext::getRequestId();
}
