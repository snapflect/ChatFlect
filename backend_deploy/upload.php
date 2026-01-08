<?php
require 'db.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_FILES['file'])) {
    $target_dir = "uploads/";
    if (!file_exists($target_dir)) {
        mkdir($target_dir, 0777, true);
    }

    $ext = pathinfo($_FILES['file']['name'], PATHINFO_EXTENSION);
    $filename = uniqid() . '.' . $ext;
    $target_file = $target_dir . $filename;

    if (move_uploaded_file($_FILES['file']['tmp_name'], $target_file)) {
        // Return relative path. Frontend should prepend Base URL.
        echo json_encode(["status" => "success", "url" => $target_file]);
    } else {
        http_response_code(500);
        echo json_encode(["error" => "Upload failed"]);
    }
}
?>