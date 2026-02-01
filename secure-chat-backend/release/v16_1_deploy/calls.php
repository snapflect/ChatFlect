<?php
require 'db.php';
require_once 'rate_limiter.php';
require_once 'auth_middleware.php';

// Enforce rate limiting
enforceRateLimit();

$data = json_decode(file_get_contents("php://input"), true);

if (isset($data['action'])) {
    if ($data['action'] === 'initiate') {
        // Require authentication
        $authUserId = requireAuth();

        // Sanitize inputs
        $caller = sanitizeUserId($data['caller_id'] ?? '');
        $receiver = sanitizeUserId($data['receiver_id'] ?? '');
        $type = in_array($data['type'] ?? 'audio', ['audio', 'video', 'group_audio', 'group_video'])
            ? $data['type']
            : 'audio';

        // Verify caller matches authenticated user
        if ($caller !== $authUserId) {
            http_response_code(403);
            echo json_encode(["error" => "Cannot initiate call for another user"]);
            exit;
        }

        $stmt = $conn->prepare("INSERT INTO calls (caller_id, receiver_id, type) VALUES (?, ?, ?)");
        $stmt->bind_param("sss", $caller, $receiver, $type);

        if ($stmt->execute()) {
            auditLog('call_initiated', $caller, ['receiver' => $receiver, 'type' => $type]);
            echo json_encode(["status" => "success", "call_id" => $conn->insert_id]);
        } else {
            http_response_code(500);
            echo json_encode(["error" => "Failed to initiate call"]);
        }
        $stmt->close();

    } elseif ($data['action'] === 'end' && isset($data['call_id'])) {
        $authUserId = requireAuth();
        $callId = sanitizeInt($data['call_id']);

        $stmt = $conn->prepare("UPDATE calls SET status = 'ended', end_time = NOW() WHERE id = ?");
        $stmt->bind_param("i", $callId);

        if ($stmt->execute()) {
            auditLog('call_ended', $authUserId, ['call_id' => $callId]);
            echo json_encode(["status" => "success"]);
        } else {
            http_response_code(500);
            echo json_encode(["error" => "Failed to end call"]);
        }
        $stmt->close();

    } elseif ($data['action'] === 'history') {
        $authUserId = requireAuth();
        $userId = sanitizeUserId($data['user_id'] ?? '');

        // Can only view own call history
        if ($userId !== $authUserId) {
            http_response_code(403);
            echo json_encode(["error" => "Cannot view another user's call history"]);
            exit;
        }

        $stmt = $conn->prepare("SELECT * FROM calls WHERE caller_id = ? OR receiver_id = ? ORDER BY start_time DESC LIMIT 50");
        $stmt->bind_param("ss", $userId, $userId);
        $stmt->execute();
        $result = $stmt->get_result();

        $calls = [];
        while ($row = $result->fetch_assoc()) {
            $calls[] = $row;
        }
        echo json_encode($calls);
        $stmt->close();
    }
}
?>