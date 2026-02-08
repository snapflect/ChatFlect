<?php
// api/admin/v1/alerts.php
// Epic 31: SLA Targets + Alert Threshold Rules

require_once __DIR__ . '/../../../includes/admin_auth.php';
require_once __DIR__ . '/../../../includes/alert_rules.php';

header('Content-Type: application/json');

try {
    $adminId = requireAdminAuth();
    $pdo = getAdminPdo();

    $action = $_GET['action'] ?? 'evaluate';
    $hours = isset($_GET['hours']) ? (int) $_GET['hours'] : 24;

    switch ($action) {
        case 'evaluate':
            // Run SLA evaluation
            $result = evaluateSystemHealth($pdo, 60);

            // Persist any new alerts
            foreach ($result['alerts'] as $alert) {
                persistAlert($pdo, $alert);
            }

            echo json_encode([
                'success' => true,
                'status' => $result['status'],
                'alerts' => $result['alerts'],
                'metrics' => $result['metrics'],
                'request_id' => RequestContext::getRequestId()
            ]);
            break;

        case 'active':
            $alerts = getActiveAlerts($pdo);
            echo json_encode([
                'success' => true,
                'active_alerts' => $alerts,
                'count' => count($alerts)
            ]);
            break;

        case 'history':
            $alerts = getRecentAlerts($pdo, $hours);
            echo json_encode([
                'success' => true,
                'alerts' => $alerts,
                'hours' => $hours,
                'count' => count($alerts)
            ]);
            break;

        case 'resolve':
            $alertId = $_POST['alert_id'] ?? $_GET['alert_id'] ?? null;
            if (!$alertId) {
                http_response_code(400);
                echo json_encode(['error' => 'MISSING_ALERT_ID']);
                exit;
            }
            resolveAlert($pdo, $alertId);
            echo json_encode(['success' => true, 'resolved' => $alertId]);
            break;

        default:
            http_response_code(400);
            echo json_encode(['error' => 'INVALID_ACTION']);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'SERVER_ERROR', 'message' => $e->getMessage()]);
}
