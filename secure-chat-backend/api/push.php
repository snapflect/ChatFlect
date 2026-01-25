<?php
require 'db.php';
require_once 'rate_limiter.php';
require_once 'auth_middleware.php';

// Enforce rate limiting
enforceRateLimit();
// IMPORTANT: Upload your 'service-account.json' to the same folder as this file.

function getAccessToken($serviceAccountPath)
{
    if (!file_exists($serviceAccountPath))
        return null;
    $keys = json_decode(file_get_contents($serviceAccountPath), true);

    $jwtHeader = base64_encode(json_encode(['alg' => 'RS256', 'typ' => 'JWT']));
    $now = time();
    $jwtClaim = base64_encode(json_encode([
        'iss' => $keys['client_email'],
        'scope' => 'https://www.googleapis.com/auth/firebase.messaging',
        'aud' => 'https://oauth2.googleapis.com/token',
        'exp' => $now + 3600,
        'iat' => $now
    ]));

    // Sign
    $input = "$jwtHeader.$jwtClaim";
    $privateKey = $keys['private_key'];
    openssl_sign($input, $signature, $privateKey, 'SHA256');
    $jwtSignature = base64_encode($signature);
    $jwt = "$input.$jwtSignature";

    // Exchange for Access Token
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, 'https://oauth2.googleapis.com/token');
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
        'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        'assertion' => $jwt
    ]));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    // DEBUG: Disable SSL check temporarily if needed, but better to fix certs
    // curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); 

    $result = curl_exec($ch);

    if ($result === false) {
        $error = curl_error($ch);
        curl_close($ch);
        return ["error" => "cURL Error (Token): $error"];
    }

    $response = json_decode($result, true);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if (isset($response['error'])) {
        return ["error" => "Google OAuth Error: " . ($response['error_description'] ?? $response['error'])];
    }

    if ($httpCode !== 200) {
        return ["error" => "Google OAuth HTTP $httpCode: $result"];
    }

    return $response['access_token'] ?? null;
}

$data = json_decode(file_get_contents("php://input"), true);

if (isset($data['target_user_id']) && isset($data['title'])) {
    $target_id = $data['target_user_id'];

    // Get Tokens (Multi-Device Support)
    $tokens = [];

    // 1. Get from user_devices
    // Added table check logic implicitly via query success
    $stmt = $conn->prepare("SELECT fcm_token FROM user_devices WHERE user_id = ? AND fcm_token IS NOT NULL AND fcm_token != ''");
    if ($stmt) {
        $stmt->bind_param("s", $target_id);
        $stmt->execute();
        $res = $stmt->get_result();
        while ($row = $res->fetch_assoc()) {
            $tokens[] = $row['fcm_token'];
        }
        $stmt->close();
    }

    // 2. Fallback to `users` table (Legacy)
    if (empty($tokens)) {
        $stmt = $conn->prepare("SELECT fcm_token FROM users WHERE user_id = ?");
        $stmt->bind_param("s", $target_id);
        $stmt->execute();
        $result = $stmt->get_result();
        if ($row = $result->fetch_assoc()) {
            if ($row['fcm_token'])
                $tokens[] = $row['fcm_token'];
        }
        $stmt->close();
    }

    $tokens = array_unique($tokens);

    if (empty($tokens))
        exit;

    $accessToken = getAccessToken('service-account.json');

    if (is_array($accessToken) && isset($accessToken['error'])) {
        http_response_code(500);
        echo json_encode($accessToken);
        exit;
    }

    if (!$accessToken) {
        http_response_code(500);
        echo json_encode(["error" => "Unknown error generating access token"]);
        exit;
    }

    $projectId = json_decode(file_get_contents('service-account.json'), true)['project_id'];

    // Loop Send
    foreach ($tokens as $to) {
        // Get custom data and channel from request
        $customData = isset($data['data']) ? json_decode($data['data'], true) : [];
        $androidChannelId = $data['android_channel_id'] ?? 'messages';

        // Determine sound based on notification type
        $isCallNotification = ($customData['type'] ?? '') === 'call_invite';
        $sound = 'default';

        // Set priority - calls need high priority to wake device
        $priority = $isCallNotification ? 'high' : 'normal';

        // V1 Payload Structure
        $payload = [
            'message' => [
                'token' => $to,
                'notification' => [
                    'title' => $data['title'],
                    'body' => $data['body'] ?? 'New Message'
                ],
                'data' => array_merge([
                    'click_action' => 'FCM_PLUGIN_ACTIVITY',
                    'id' => uniqid()
                ], $customData),
                'android' => [
                    'priority' => $priority,
                    'notification' => [
                        'channel_id' => $androidChannelId,
                        'sound' => $sound,
                        'default_vibrate_timings' => false,
                        'vibrate_timings' => ['0.5s', '0.5s', '0.5s', '0.5s'],
                        'default_light_settings' => true
                    ]
                ],
                'apns' => [
                    'payload' => [
                        'aps' => [
                            'sound' => $isCallNotification ? 'ringtone.caf' : 'default',
                            'content-available' => 1
                        ]
                    ]
                ]
            ]
        ];

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, "https://fcm.googleapis.com/v1/projects/$projectId/messages:send");
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Bearer ' . $accessToken,
            'Content-Type: application/json'
        ]);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        $result = curl_exec($ch);
        curl_close($ch);

        // echo $result; // Echoing might mess up JSON response if we want to return success count, but current client doesn't check specific per-token ID.
    }

    echo json_encode(["status" => "sent", "count" => count($tokens)]);

} else {
    // missing params
}
?>