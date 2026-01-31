<?php
require_once 'db.php';
require_once 'rate_limiter.php';
enforceRateLimit();
header('Content-Type: application/json; charset=utf-8');

// Headers handled by db.php

// GET { user_id } -> Return Public Key
// GET { phone_number } -> Return Public Key (for contacts)

if (isset($_GET['user_id'])) {
    $uid = $_GET['user_id'];

    // 1. Try fetching device keys
    $stmt = $conn->prepare("SELECT device_uuid, public_key FROM user_devices WHERE user_id = ?");
    $stmt->bind_param("s", $uid);
    $stmt->execute();
    $resDevices = $stmt->get_result();

    $deviceKeys = [];
    while ($row = $resDevices->fetch_assoc()) {
        $deviceKeys[$row['device_uuid']] = $row['public_key'];
    }

    // 2. Fetch primary key (legacy fallback or primary device)
    $stmt = $conn->prepare("SELECT public_key FROM users WHERE user_id = ?");
    $stmt->bind_param("s", $uid);
    $stmt->execute();
    $resUser = $stmt->get_result()->fetch_assoc();

    if ($resUser) {
        // If we found device keys, return them.
        // If NO device keys, but user exists (legacy), return primary key in a 'legacy' slot or as singular
        // To maintain backward compatibility with Phase 1 frontend, we might need a flag.
        // BUT Phase 2 frontend expects a list.

        // Structure:
        // {
        //   "public_key": "LEGACY_KEY", // For backward compat
        //   "devices": { "uuid1": "key1", "uuid2": "key2" }
        // }

        $response = [
            "public_key" => $resUser['public_key'], // Primary/Legacy Key
            "devices" => $deviceKeys
        ];

        echo json_encode($response);
    } else {
        http_response_code(404);
        echo json_encode(["error" => "User not found"]);
    }

} elseif (isset($_GET['phone_number'])) {
    // Similar logic for phone lookups not fully expanded here as app uses user_id mostly
    // For now, keep simple return
    $ph = $_GET['phone_number'];
    $stmt = $conn->prepare("SELECT user_id, public_key FROM users WHERE phone_number = ?");
    $stmt->bind_param("s", $ph);
    $stmt->execute();
    $result = $stmt->get_result()->fetch_assoc();

    if ($result) {
        // Also fetch devices
        $uid = $result['user_id'];
        $stmtDevice = $conn->prepare("SELECT device_uuid, public_key FROM user_devices WHERE user_id = ?");
        $stmtDevice->bind_param("s", $uid);
        $stmtDevice->execute();
        $resDevices = $stmtDevice->get_result();

        $deviceKeys = [];
        while ($row = $resDevices->fetch_assoc()) {
            $deviceKeys[$row['device_uuid']] = $row['public_key'];
        }

        echo json_encode([
            "user_id" => $uid,
            "public_key" => $result['public_key'],
            "devices" => $deviceKeys
        ]);
    } else {
        http_response_code(404);
        echo json_encode(["error" => "User not found"]);
    }
} else {
    echo json_encode(["error" => "Missing param"]);
    exit;
}
?>