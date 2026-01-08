<?php
require 'db.php';
$data = json_decode(file_get_contents("php://input"), true);

if (isset($data['action'])) {
    if ($data['action'] === 'initiate') {
        $caller = $conn->real_escape_string($data['caller_id']);
        $receiver = $conn->real_escape_string($data['receiver_id']);
        $type = $conn->real_escape_string($data['type']);

        $sql = "INSERT INTO calls (caller_id, receiver_id, type) VALUES ('$caller', '$receiver', '$type')";
        $conn->query($sql);
    } elseif ($data['action'] === 'end' && isset($data['call_id'])) {
        // ... (Optional update logic)
    }
}
?>