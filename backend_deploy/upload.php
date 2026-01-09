<?php
// upload.php - Blind Storage for Encrypted Blobs
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    exit;
}

$uploadDir = '../uploads/';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

if (isset($_FILES['file'])) {
    $file = $_FILES['file'];
    $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
    // Generate Random UUID/Name to anonymize
    $filename = uniqid('enc_') . bin2hex(random_bytes(8)) . '.' . $ext;
    $targetPath = $uploadDir . $filename;

    if (move_uploaded_file($file['tmp_name'], $targetPath)) {
        // Return full URL (assuming relative for now, client app will prepend baseURL)
        echo json_encode([
            "status" => "success",
            "url" => "uploads/" . $filename
        ]);
    } else {
        http_response_code(500);
        echo json_encode(["error" => "Upload failed"]);
    }
} else {
    http_response_code(400);
    echo json_encode(["error" => "No file received"]);
}
?>