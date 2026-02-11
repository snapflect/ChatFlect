<?php
// api/v4/receipts/config.php
require_once __DIR__ . '/../../includes/auth_middleware.php';
require_once __DIR__ . '/../../includes/privacy_engine.php';

$user = authenticate();
$pe = new PrivacyEngine($pdo);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);

    if (isset($input['enabled'])) {
        $val = $input['enabled'] ? 1 : 0;
        $pe->updateSetting($user['user_id'], 'read_receipts_enabled', $val);
        echo json_encode(['success' => true]);
        exit;
    }
    http_response_code(400);
    echo json_encode(['error' => 'Missing parameter']);
    exit;
}

// GET
$settings = $pe->getSettings($user['user_id']);
echo json_encode(['success' => true, 'enabled' => (bool) $settings['read_receipts_enabled']]);
