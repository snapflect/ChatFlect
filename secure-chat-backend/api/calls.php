<?php
require 'db.php';
$data = json_decode(file_get_contents("php://input"), true);

if (isset($data['action'])) {
    if ($data['action'] === 'initiate') {
        $caller = $data['caller_id'] ?? '';
        $receiver = $data['receiver_id'] ?? '';
        $type = $data['type'] ?? 'audio';

        $stmt = $conn->prepare("INSERT INTO calls (caller_id, receiver_id, type) VALUES (?, ?, ?)");
        $stmt->bind_param("sss", $caller, $receiver, $type);
        
        if ($stmt->execute()) {
            echo json_encode(["status" => "success", "call_id" => $conn->insert_id]);
        } else {
            http_response_code(500);
            echo json_encode(["error" => "Failed to initiate call"]);
        }
        $stmt->close();

    } elseif ($data['action'] === 'end' && isset($data['call_id'])) {
        $callId = $data['call_id'];
        $stmt = $conn->prepare("UPDATE calls SET status = 'ended', end_time = NOW() WHERE id = ?");
        $stmt->bind_param("i", $callId);
        
        if ($stmt->execute()) {
            echo json_encode(["status" => "success"]);
        } else {
            http_response_code(500);
            echo json_encode(["error" => "Failed to end call"]);
        }
        $stmt->close();

    } elseif ($data['action'] === 'history') {
        $userId = $data['user_id'] ?? '';
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