<?php
// includes/cost_logger.php
// Epic 22: Cost Analysis

if (!function_exists('logCostMetric')) {
    function logCostMetric($action, $readops, $writeops, $payload_kb, $time_ms)
    {
        $logFile = __DIR__ . '/../../logs/cost_metrics.log';

        // Ensure logs dir exists
        $dir = dirname($logFile);
        if (!is_dir($dir))
            mkdir($dir, 0777, true);

        // Format: TIMESTAMP | ACTION | READS | WRITES | KB | LATENCY_MS
        $entry = sprintf(
            "%s | %s | R:%d | W:%d | KB:%.2f | MS:%.2f\n",
            date('Y-m-d H:i:s'),
            str_pad($action, 20),
            $readops,
            $writeops,
            $payload_kb,
            $time_ms
        );

        file_put_contents($logFile, $entry, FILE_APPEND);
    }
}
