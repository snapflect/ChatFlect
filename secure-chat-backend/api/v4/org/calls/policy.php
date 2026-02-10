<?php
// api/v4/org/calls/policy.php
// Epic 77: Admin Policy Config

require_once __DIR__ . '/../../../includes/auth_middleware.php';

$user = authenticate(); // Check admin role in real app
$input = json_decode(file_get_contents('php://input'), true);

try {
    // Mock Org ID
    $orgId = 1;

    $allowCalls = $input['allow_calls'] ?? true;
    $allowVideo = $input['allow_video'] ?? true;
    $requireVerified = $input['require_verified'] ?? false;

    $stmt = $pdo->prepare("
        INSERT INTO org_call_policies (org_id, allow_calls, allow_video, require_verified_contacts)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
            allow_calls=VALUES(allow_calls),
            allow_video=VALUES(allow_video),
            require_verified_contacts=VALUES(require_verified_contacts)
    ");
    $stmt->execute([$orgId, $allowCalls, $allowVideo, $requireVerified]);

    echo json_encode(['success' => true]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}
