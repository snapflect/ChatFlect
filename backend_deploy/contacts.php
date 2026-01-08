<?php
require 'db.php';
$data = json_decode(file_get_contents("php://input"), true);

if (isset($data['phone_numbers'])) {
    $phones = $data['phone_numbers'];
    if (empty($phones)) {
        echo json_encode([]);
        exit;
    }

    $escaped_phones = array_map(function ($p) use ($conn) {
        return "'" . $conn->real_escape_string($p) . "'";
    }, $phones);

    $list = implode(',', $escaped_phones);

    $sql = "SELECT user_id, first_name, last_name, phone_number, photo_url, short_note FROM users WHERE phone_number IN ($list)";
    $result = $conn->query($sql);

    $contacts = [];
    while ($row = $result->fetch_assoc()) {
        $contacts[] = $row;
    }
    echo json_encode($contacts);
}
?>