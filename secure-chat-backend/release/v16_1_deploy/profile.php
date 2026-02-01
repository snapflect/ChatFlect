<?php
// Polyfill for PHP < 8.0
if (!function_exists('str_starts_with')) {
    function str_starts_with($haystack, $needle)
    {
        return (string) $needle !== '' && strncmp($haystack, $needle, strlen($needle)) === 0;
    }
}

if (!function_exists('str_contains')) {
    function str_contains($haystack, $needle)
    {
        return $needle !== '' && mb_strpos($haystack, $needle) !== false;
    }
}

require_once 'db.php';
require_once 'rate_limiter.php';
require_once 'auth_middleware.php';

// Enforce rate limiting
enforceRateLimit();

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
    /* ---------- OTP CONFIRM (HYBRID) ---------- */
    if (isset($data->action) && $data->action === 'confirm_otp') {
        $email = $data->email ?? '';
        $otp = $data->otp ?? '';
        $publicKey = $data->public_key ?? '';

        // Validate
        if (!$email || !$otp) {
            http_response_code(400);
            echo json_encode(["error" => "Missing email or OTP"]);
            exit;
        }

        // 1. Verify OTP
        $stmt = $conn->prepare("SELECT id FROM otps WHERE email = ? AND otp_code = ? AND expires_at > NOW()");
        $stmt->bind_param("ss", $email, $otp);
        $stmt->execute();
        $res = $stmt->get_result();

        if ($res->num_rows === 0) {
            http_response_code(400);
            echo json_encode(["error" => "Invalid or Expired OTP"]);
            exit;
        }

        // 2. Check/Create User
        $cachedExists = CacheService::checkUserExists($email);
        $userRes = null;
        if ($cachedExists === true) {
            $check = $conn->prepare("SELECT user_id, is_profile_complete FROM users WHERE email = ?");
            $check->bind_param("s", $email);
            $check->execute();
            $userRes = $check->get_result();
        } else {
            $check = $conn->prepare("SELECT user_id, is_profile_complete FROM users WHERE email = ?");
            $check->bind_param("s", $email);
            $check->execute();
            $userRes = $check->get_result();
            if ($userRes->num_rows > 0) {
                CacheService::cacheUserExistence($email, true);
            }
        }

        $userId = null;
        $isNewUser = false;
        $isProfileComplete = 0;

        if ($userRes->num_rows > 0) {
            // Existing
            $row = $userRes->fetch_assoc();
            $userId = trim(strtoupper($data->user_id)); // v16.0 Zero-Trust Normalization
            $isProfileComplete = (int) $row['is_profile_complete'];

            // Update Key
            $upd = $conn->prepare("UPDATE users SET public_key = ? WHERE user_id = ?");
            $upd->bind_param("ss", $publicKey, $userId);
            $upd->execute();
            $upd->close();
        } else {
            // New
            $isNewUser = true;
            $userId = 'U' . strtoupper(bin2hex(random_bytes(12)));
            $isProfileComplete = 0;

            $ins = $conn->prepare("INSERT INTO users (user_id, email, public_key, is_profile_complete) VALUES (?, ?, ?, 0)");
            $ins->bind_param("sss", $userId, $email, $publicKey);
            if (!$ins->execute()) {
                http_response_code(500);
                echo json_encode(["error" => "Registration DB Error: " . $ins->error]);
                exit;
            }
            $ins->close();
        }

        // 3. Clear OTP
        $del = $conn->prepare("DELETE FROM otps WHERE email = ?");
        $del->bind_param("s", $email);
        $del->execute();

        // 4. Create Session (Architectural Caching & Session Management)
        $jti = 'U' . strtoupper(bin2hex(random_bytes(12)));
        $refreshToken = bin2hex(random_bytes(32));
        $deviceUuid = $data->device_uuid ?? 'unknown';
        $expires = date('Y-m-d H:i:s', strtotime('+24 hours'));

        $sess = $conn->prepare("INSERT INTO user_sessions (user_id, device_uuid, id_token_jti, refresh_token, expires_at)
                                VALUES (?, ?, ?, ?, ?)
                                ON DUPLICATE KEY UPDATE id_token_jti = ?, refresh_token = ?, expires_at = ?");
        $sess->bind_param("ssssssss", $userId, $deviceUuid, $jti, $refreshToken, $expires, $jti, $refreshToken, $expires);
        $sess->execute();

        // 5. Cache Session for instant auth
        CacheService::cacheSession($jti, $userId, ['device' => $deviceUuid]);

        // Audit log successful login
        auditLog(AUDIT_LOGIN_SUCCESS, $userId, ['method' => 'email_otp', 'is_new_user' => $isNewUser]);

        echo json_encode([
            "status" => "success",
            "message" => "Login Successful",
            "user_id" => $userId,
            "token" => $jti,
            "refresh_token" => $refreshToken,
            "is_new_user" => $isNewUser,
            "is_profile_complete" => $isProfileComplete
        ]);
        exit;
    }

    /* ---------- VERIFY PHONE OTP (HYBRID) ---------- */
    if (isset($data->action) && $data->action === 'verify_phone_otp') {
        $email = $data->email ?? '';
        $otp = $data->otp ?? '';

        if (!$email || !$otp) {
            http_response_code(400);
            echo json_encode(["error" => "Missing email or OTP"]);
            exit;
        }

        // 1. Verify OTP
        $stmt = $conn->prepare("SELECT phone_number FROM otps WHERE email = ? AND otp_code = ? AND type = 'phone_update' AND expires_at > NOW()");
        $stmt->bind_param("ss", $email, $otp);
        $stmt->execute();
        $res = $stmt->get_result();

        if ($row = $res->fetch_assoc()) {
            $newPhone = $row['phone_number'];

            // 2. Uniqueness Check (Final)
            $pCheck = $conn->prepare("SELECT user_id FROM users WHERE phone_number = ?");
            $pCheck->bind_param("s", $newPhone);
            $pCheck->execute();
            if ($pCheck->get_result()->num_rows > 0) {
                http_response_code(409);
                echo json_encode(["error" => "This phone number is already linked to another account"]);
                exit;
            }

            // 3. Resolve user_id from email
            $uCheck = $conn->prepare("SELECT user_id FROM users WHERE email = ?");
            $uCheck->bind_param("s", $email);
            $uCheck->execute();
            $uRow = $uCheck->get_result()->fetch_assoc();
            $userId = $uRow['user_id'] ?? null;

            if ($userId) {
                // 4. Update Phone
                $upd = $conn->prepare("UPDATE users SET phone_number = ?, is_profile_complete = 1 WHERE user_id = ?");
                $upd->bind_param("ss", $newPhone, $userId);
                $upd->execute();

                // 5. Clear OTP
                $del = $conn->prepare("DELETE FROM otps WHERE email = ? AND type = 'phone_update'");
                $del->bind_param("s", $email);
                $del->execute();

                echo json_encode(["status" => "success", "message" => "Phone number verified and updated"]);
            } else {
                http_response_code(404);
                echo json_encode(["error" => "User not found"]);
            }
        } else {
            http_response_code(400);
            echo json_encode(["error" => "Invalid or Expired OTP"]);
        }
        exit;
    }

    /* ---------- PROFILE UPDATE ---------- */
    if (isset($data->user_id)) {
        // Require authentication and verify user matches
        $userId = sanitizeUserId($data->user_id);
        requireAuth($userId);

        $check = $conn->prepare("SELECT id, phone_number, is_profile_complete FROM users WHERE user_id = ?");
        $check->bind_param("s", $userId);
        $check->execute();
        $userRow = $check->get_result()->fetch_assoc();

        if (!$userRow) {
            http_response_code(404);
            echo json_encode(["error" => "User ID not found"]);
            exit;
        }

        $fields = [];
        $types = "";
        $params = [];

        // Mandatory Phone Registration / Update Policy
        if (isset($data->phone_number)) {
            $newPhone = sanitizeString($data->phone_number, 20);

            // 1. Check if phone is different and update is allowed
            if ($newPhone !== $userRow['phone_number']) {
                // 2. Uniqueness Check: Ensure phone is not linked to ANOTHER email
                $pCheck = $conn->prepare("SELECT email FROM users WHERE phone_number = ? AND user_id != ?");
                $pCheck->bind_param("ss", $newPhone, $userId);
                $pCheck->execute();
                if ($pCheck->get_result()->num_rows > 0) {
                    http_response_code(409);
                    echo json_encode(["error" => "This phone number is already linked to another account"]);
                    exit;
                }

                $fields[] = "phone_number=?";
                $types .= "s";
                $params[] = $newPhone;

                // If this was the missing piece, mark profile complete
                $fields[] = "is_profile_complete=1";
            }
        }

        if (isset($data->first_name)) {
            $fields[] = "first_name=?";
            $types .= "s";
            $params[] = sanitizeString($data->first_name, 50);
        }
        if (isset($data->last_name)) {
            $fields[] = "last_name=?";
            $types .= "s";
            $params[] = sanitizeString($data->last_name, 50);
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

    $userId = isset($_GET['user_id']) ? trim(strtoupper($_GET['user_id'])) : ''; // v16.0 Zero-Trust Normalization
    if (!$userId) {
        http_response_code(400);
        echo json_encode(["error" => "user_id required"]);
        exit;
    }

    $stmt = $conn->prepare("
        SELECT user_id, email, first_name, last_name, short_note, photo_url, phone_number, is_profile_complete
        FROM users WHERE user_id = ?
    ");
    $stmt->bind_param("s", $userId);
    $stmt->execute();
    $profile = $stmt->get_result()->fetch_assoc();

    /* ---------- STANDARD PROXY FIX ---------- */
    // If it's a local upload, route it through serve.php
    if ($profile && !empty($profile['photo_url']) && str_starts_with($profile['photo_url'], 'uploads/')) {
        $profile['photo_url'] = 'serve.php?file=' . $profile['photo_url'];
    }

    echo json_encode($profile);
}