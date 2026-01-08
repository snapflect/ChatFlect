<?php
require 'db.php';

if (isset($_GET['user_id'])) {
    $uid = $conn->real_escape_string($_GET['user_id']);
    $result = $conn->query("SELECT public_key FROM users WHERE user_id = '$uid'");
    if ($row = $result->fetch_assoc()) {
        echo json_encode($row);
    } else {
        http_response_code(404);
        echo json_encode(["error" => "Not found"]);
    }
}
?>