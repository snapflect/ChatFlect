<?php
// api/v4/privacy/update.php
require_once __DIR__ . '/../../includes/auth_middleware.php';
require_once __DIR__ . '/../../includes/privacy_engine.php';

$user = authenticate();
$input = json_decode(file_get_contents('php://input'), true);

if (!isset($input['field']) || !isset($input['value'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing field/value']);
    exit;
}

try {
    $pe = new PrivacyEngine($pdo);
    $pe->updateSetting($user['user_id'], $input['field'], $input['value']);
    echo json_encode(['success' => true]);
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
