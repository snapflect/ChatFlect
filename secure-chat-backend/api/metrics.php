<?php
// api/metrics.php
// Epic 92: Prometheus Metrics Endpoint
require_once __DIR__ . '/../api/db.php';
require_once __DIR__ . '/../includes/secrets_manager.php';

// Security: Restrict access via Token (Epic 92-HF)
$metricsToken = SecretsManager::get('METRICS_TOKEN');
if ($metricsToken) {
    $authHeader = $_SERVER['HTTP_X_METRICS_TOKEN'] ?? null;
    if ($authHeader !== $metricsToken) {
        http_response_code(403);
        die("# HELP chatflect_access_denied Access Denied\n# TYPE chatflect_access_denied gauge\nchatflect_access_denied 1\n");
    }
}

header('Content-Type: text/plain; version=0.0.4');

function getMetric($name, $type, $help, $value, $labels = [])
{
    $out = "# HELP $name $help\n";
    $out .= "# TYPE $name $type\n";

    $labelStr = "";
    if (!empty($labels)) {
        $pairs = [];
        foreach ($labels as $k => $v) {
            $pairs[] = "$k=\"$v\"";
        }
        $labelStr = "{" . implode(",", $pairs) . "}";
    }

    $out .= "$name$labelStr $value\n";
    return $out;
}

try {
    $pdo = getDbPdo();

    // 1. System Metrics
    echo getMetric('chatflect_up', 'gauge', 'System Status', 1);
    echo getMetric('chatflect_memory_usage_bytes', 'gauge', 'PHP Memory Usage', memory_get_usage());

    // 2. Business Metrics - Users
    $stmt = $pdo->query("SELECT COUNT(*) FROM users");
    $userCount = $stmt->fetchColumn();
    echo getMetric('chatflect_users_total', 'gauge', 'Total Registered Users', $userCount);

    // 3. Business Metrics - Messages
    $stmt = $pdo->query("SELECT COUNT(*) FROM messages");
    $msgCount = $stmt->fetchColumn();
    echo getMetric('chatflect_messages_total', 'counter', 'Total Messages Sent', $msgCount);

    // 4. Business Metrics - Active Allocations (Approximate)
    $stmt = $pdo->query("SELECT COUNT(*) FROM prekeys");
    $keyCount = $stmt->fetchColumn();
    echo getMetric('chatflect_prekeys_total', 'gauge', 'Total Prekeys Available', $keyCount);

} catch (Exception $e) {
    echo getMetric('chatflect_up', 'gauge', 'System Status', 0);
    echo getMetric('chatflect_scrape_error', 'gauge', 'Scrape Error', 1, ['error' => $e->getMessage()]);
}
