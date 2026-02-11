<?php
// api/v4/privacy/get.php
require_once __DIR__ . '/../../includes/auth_middleware.php';
require_once __DIR__ . '/../../includes/privacy_engine.php';

$user = authenticate();

try {
    $pe = new PrivacyEngine($pdo);
    $settings = $pe->getSettings($user['user_id']);
    echo json_encode(['success' => true, 'settings' => $settings]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
