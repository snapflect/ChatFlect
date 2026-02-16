<?php
// api/v4/privacy/screenshot_event.php
// HF-80.3: Screenshot Notification
require_once __DIR__ . '/../../includes/auth_middleware.php';

$user = authenticate();
$input = json_decode(file_get_contents('php://input'), true);

// Log Screenshot Event
// Ideally notify sender via push/socket
// For MVP/Backend: Log it safely

$stmt = $pdo->prepare("INSERT INTO privacy_events (user_id, event_type, target_id, created_at) VALUES (?, 'SCREENSHOT', ?, NOW())");
$stmt->execute([$user['user_id'], $input['message_id'] ?? 'UNKNOWN']);

echo json_encode(['success' => true]);
