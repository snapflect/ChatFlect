<?php
require 'db.php';

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
    $response = json_decode(curl_exec($ch), true);
    curl_close($ch);

    return $response['access_token'] ?? null;
}

$data = json_decode(file_get_contents("php://input"), true);

if (isset($data['target_user_id']) && isset($data['title'])) {
    $target_id = $conn->real_escape_string($data['target_user_id']);

    // Get Token
    $res = $conn->query("SELECT fcm_token FROM users WHERE user_id = '$target_id'");
    if ($row = $res->fetch_assoc()) {
        $to = $row['fcm_token'];
        if (!$to)
            exit;

        $accessToken = getAccessToken('service-account.json');
        if (!$accessToken) {
            http_response_code(500);
            echo json_encode(["error" => "Service Account missing or invalid"]);
            exit;
        }

        // Get custom data and channel from request
        $customData = isset($data['data']) ? json_decode($data['data'], true) : [];
        $androidChannelId = $data['android_channel_id'] ?? 'messages';

        // Determine sound based on notification type
        // FIX: Use 'default' to prevent OS from playing a long looping ringtone that duplicates the App's ringtone.
        // The App (SoundService) will handle the ringing when active.
        $isCallNotification = ($customData['type'] ?? '') === 'call_invite';
        $sound = 'default'; // Always use default system sound (short beep/ding)

        // Set priority - calls need high priority to wake device
        $priority = $isCallNotification ? 'high' : 'normal';

        // V1 Payload Structure with Android-specific settings
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
        $projectId = json_decode(file_get_contents('service-account.json'), true)['project_id'];
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

        echo $result;
    }
}
?>