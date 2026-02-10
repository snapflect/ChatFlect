<?php
// api/v4/org/messages/policy.php
// Epic 78: Set Msg Policy

require_once __DIR__ . '/../../../includes/auth_middleware.php';

$user = authenticate();
$input = json_decode(file_get_contents('php://input'), true);

try {
    $orgId = 1; // Mock

    $stmt = $pdo->prepare("
        INSERT INTO org_message_policies (org_id, allow_media, allow_forwarding)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE 
            allow_media=VALUES(allow_media),
            allow_forwarding=VALUES(allow_forwarding)
    ");
    $stmt->execute([$orgId, $input['allow_media'] ?? true, $input['allow_forwarding'] ?? true]);

    echo json_encode(['success' => true]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
