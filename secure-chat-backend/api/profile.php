<?php
require 'db.php';

// Headers handled by db.php

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function getBaseUrl(): string
{
    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    return $protocol . '://' . $_SERVER['HTTP_HOST'];
}

$method = $_SERVER['REQUEST_METHOD'];
$data = json_decode(file_get_contents("php://input"));

if ($method === 'POST' && json_last_error() !== JSON_ERROR_NONE) {
    http_response_code(400);
    echo json_encode(["error" => "Invalid JSON"]);
    exit;
}

if ($method === 'POST') {

    /* ---------- OTP CONFIRM (UNCHANGED) ---------- */
    if (isset($data->action) && $data->action === 'confirm_otp') {
        $phone = $data->phone_number ?? '';
        $otp = $data->otp ?? '';
        $email = $data->email ?? '';
        $publicKey = $data->public_key ?? '';

        // Validate
        if (!$phone || !$otp) {
            http_response_code(400);
            echo json_encode(["error" => "Missing phone or OTP"]);
            exit;
        }

        // 1. Verify OTP
        $stmt = $conn->prepare("SELECT id FROM otps WHERE phone_number = ? AND otp_code = ? AND expires_at > NOW()");
        $stmt->bind_param("ss", $phone, $otp);
        $stmt->execute();
        $res = $stmt->get_result();

        if ($res->num_rows === 0) {
            http_response_code(400); // 400 for logic error vs 401
            echo json_encode(["error" => "Invalid or Expired OTP"]);
            exit;
        }

        // 2. Strict 1:1 Check: Is Email used by DIFFERENT phone?
        if ($email) {
            $eCheck = $conn->prepare("SELECT user_id FROM users WHERE email = ? AND phone_number != ?");
            $eCheck->bind_param("ss", $email, $phone);
            $eCheck->execute();
            if ($eCheck->get_result()->num_rows > 0) {
                http_response_code(409); // Conflict
                echo json_encode(["error" => "Email already linked to another account"]);
                exit;
            }
        }

        // 3. Check/Create User
        $check = $conn->prepare("SELECT user_id FROM users WHERE phone_number = ?");
        $check->bind_param("s", $phone);
        $check->execute();
        $userRes = $check->get_result();

        $userId = null;
        $isNewUser = false;

        if ($userRes->num_rows > 0) {
            // Existing
            $row = $userRes->fetch_assoc();
            $userId = $row['user_id'];

            // Update Key & Email
            $upd = $conn->prepare("UPDATE users SET public_key = ?, email = ? WHERE user_id = ?");
            // If email is empty, maybe don't overwrite? But here we assume fresh login has fresh email.
            $upd->bind_param("sss", $publicKey, $email, $userId);
            $upd->execute();
        } else {
            // New
            $isNewUser = true;
            $userId = uniqid('user_', true);

            $ins = $conn->prepare("INSERT INTO users (user_id, phone_number, email, first_name, public_key) VALUES (?, ?, ?, ?, ?)");
            $tempName = ""; // Leave blank so user is forced/prompted to set it
            $ins->bind_param("sssss", $userId, $phone, $email, $tempName, $publicKey);
            if (!$ins->execute()) {
                http_response_code(500);
                echo json_encode(["error" => "Registration DB Error: " . $ins->error]);
                exit;
            }
        }

        // 3. Clear OTP
        $del = $conn->prepare("DELETE FROM otps WHERE phone_number = ?");
        $del->bind_param("s", $phone);
        $del->execute();

        echo json_encode([
            "status" => "success",
            "message" => "Login Successful",
            "user_id" => $userId,
            "is_new_user" => $isNewUser
        ]);
        exit;
    }

    /* ---------- PROFILE UPDATE ---------- */
    if (isset($data->user_id)) {
        $userId = $data->user_id;

        $check = $conn->prepare("SELECT id FROM users WHERE user_id = ?");
        $check->bind_param("s", $userId);
        $check->execute();
        if ($check->get_result()->num_rows === 0) {
            http_response_code(404);
            echo json_encode(["error" => "User ID not found"]);
            exit;
        }

        $fields = [];
        $types = "";
        $params = [];

        if (isset($data->first_name)) {
            $fields[] = "first_name=?";
            $types .= "s";
            $params[] = trim($data->first_name);
        }
        if (isset($data->last_name)) {
            $fields[] = "last_name=?";
            $types .= "s";
            $params[] = trim($data->last_name);
        }
        if (isset($data->short_note)) {
            $fields[] = "short_note=?";
            $types .= "s";
            $params[] = trim($data->short_note);
        }

        /* ---------- P26 FIX: PUBLIC IMAGE URL ONLY ---------- */
        if (isset($data->photo_url)) {
            $photoUrl = trim($data->photo_url);

            // If it's a serve.php URL, extract the relative path
            if (str_contains($photoUrl, 'serve.php')) {
                $parsed = parse_url($photoUrl);
                parse_str($parsed['query'] ?? '', $query);
                if (!empty($query['file'])) {
                    $photoUrl = urldecode($query['file']);
                }
            }

            // Accept absolute URLs or uploads/*
            if (
                $photoUrl &&
                filter_var($photoUrl, FILTER_VALIDATE_URL) === false &&
                !str_starts_with($photoUrl, 'uploads/')
            ) {
                $photoUrl = null;
            }

            $fields[] = "photo_url=?";
            $types .= "s";
            $params[] = $photoUrl;
        }

        if (!$fields) {
            echo json_encode(["status" => "no_fields_to_update"]);
            exit;
        }

        $sql = "UPDATE users SET " . implode(", ", $fields) . " WHERE user_id=?";
        $types .= "s";
        $params[] = $userId;

        $stmt = $conn->prepare($sql);
        $stmt->bind_param($types, ...$params);
        $stmt->execute();

        echo json_encode(["status" => "profile_updated"]);
    }

} elseif ($method === 'GET') {

    $userId = $_GET['user_id'] ?? '';
    if (!$userId) {
        http_response_code(400);
        echo json_encode(["error" => "user_id required"]);
        exit;
    }

    $stmt = $conn->prepare("
        SELECT user_id, first_name, last_name, short_note, photo_url
        FROM users WHERE user_id = ?
    ");
    $stmt->bind_param("s", $userId);
    $stmt->execute();
    $profile = $stmt->get_result()->fetch_assoc();

    /* ---------- STANDARD PROXY FIX ---------- */
    // If it's a local upload, route it through serve.php
    if (!empty($profile['photo_url']) && str_starts_with($profile['photo_url'], 'uploads/')) {
        $profile['photo_url'] = 'serve.php?file=' . $profile['photo_url'];
    }

    echo json_encode($profile);
}
