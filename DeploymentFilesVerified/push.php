<?php
// push.php - Firebase HTTP v1 API (No Composer Required)
// UPDATED: 2026-01-10
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require 'db.php';

// ENABLE LOGGING
ini_set('log_errors', 1);
ini_set('error_log', 'fcm_v1_debug.log');

function logMsg($msg)
{
    error_log(date('[Y-m-d H:i:s] ') . $msg);
}

// --- GOOGLE AUTH HELPER CLASS (No Composer) ---
class GoogleAuth
{
    private $serviceAccountPath;

    public function __construct($path)
    {
        $this->serviceAccountPath = $path;
    }

    public function getAccessToken()
    {
        if (!file_exists($this->serviceAccountPath)) {
            throw new Exception("Service Account JSON not found at: " . $this->serviceAccountPath);
        }

        $json = json_decode(file_get_contents($this->serviceAccountPath), true);
        if (!$json)
            throw new Exception("Invalid Service Account JSON");

        $now = time();
        $header = ['alg' => 'RS256', 'typ' => 'JWT'];
        $payload = [
            'iss' => $json['client_email'],
            'sub' => $json['client_email'],
            'aud' => 'https://oauth2.googleapis.com/token',
            'iat' => $now,
            'exp' => $now + 3600,
            'scope' => 'https://www.googleapis.com/auth/firebase.messaging'
        ];

        $jwt = $this->encodeJWT($header, $payload, $json['private_key']);

        // Exchange JWT for Access Token
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, 'https://oauth2.googleapis.com/token');
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
            'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            'assertion' => $jwt
        ]));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

        $response = curl_exec($ch);
        if (!$response)
            throw new Exception("OAuth2 Request Failed: " . curl_error($ch));
        curl_close($ch);

        $data = json_decode($response, true);
        if (!isset($data['access_token'])) {
            throw new Exception("Failed to get Access Token: " . $response);
        }

        return [
            'token' => $data['access_token'],
            'projectId' => $json['project_id']
        ];
    }

    private function encodeJWT($header, $payload, $privateKey)
    {
        $headerEncoded = $this->base64UrlEncode(json_encode($header));
        $payloadEncoded = $this->base64UrlEncode(json_encode($payload));
        $data = "$headerEncoded.$payloadEncoded";

        $signature = '';
        if (!openssl_sign($data, $signature, $privateKey, OPENSSL_ALGO_SHA256)) {
            throw new Exception("OpenSSL Sign Failed");
        }
        $signatureEncoded = $this->base64UrlEncode($signature);

        return "$data.$signatureEncoded";
    }

    private function base64UrlEncode($data)
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }
}

// --- MAIN LOGIC ---

// 1. Get Input
$json = file_get_contents("php://input");
$data = json_decode($json);

if (!$data) {
    logMsg("Invalid JSON Input");
    http_response_code(400);
    exit;
}

$targetUserId = $data->target_user_id ?? null;
$title = $data->title ?? 'Notification';
$body = $data->body ?? '';

$payloadData = [];
if (isset($data->data)) {
    if (is_string($data->data)) {
        $decoded = json_decode($data->data, true);
        if (is_array($decoded)) {
            $payloadData = $decoded;
        }
    } elseif (is_object($data->data) || is_array($data->data)) {
        $payloadData = (array) $data->data;
    }
}

if (!$targetUserId) {
    logMsg("Error: Missing target_user_id");
    echo json_encode(["error" => "Missing target_user_id"]);
    exit;
}

// 2. Get Recipient Token
$stmt = $conn->prepare("SELECT fcm_token FROM users WHERE user_id = ?");
$stmt->bind_param("s", $targetUserId);
$stmt->execute();
$res = $stmt->get_result()->fetch_assoc();

if (!$res || !$res['fcm_token']) {
    logMsg("No FCM Token found for User: " . $targetUserId);
    echo json_encode(["error" => "User has no FCM token"]);
    exit;
}

$token = $res['fcm_token'];

// 3. Send HTTP v1
try {
    // SECURITY: Ensure this file is uploaded and PROTECTED (chmod 600 or .htaccess deny)
    $serviceAccountFile = __DIR__ . '/service-account.json';

    $auth = new GoogleAuth($serviceAccountFile);
    $authData = $auth->getAccessToken();
    $accessToken = $authData['token'];
    $projectId = $authData['projectId'];

    $url = "https://fcm.googleapis.com/v1/projects/$projectId/messages:send";

    // V1 Message Structure
    $message = [
        'message' => [
            'token' => $token,
            'notification' => [
                'title' => $title,
                'body' => $body
            ],
            'data' => $payloadData, // V1 expects 'data' key-values to be strings!
            'android' => [
                'priority' => 'high'
            ]
        ]
    ];

    // Convert data values to strings for V1 requirement
    if (!empty($message['message']['data'])) {
        foreach ($message['message']['data'] as $k => $v) {
            $message['message']['data'][$k] = (string) $v;
        }
    }

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $accessToken,
        'Content-Type: application/json'
    ]);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($message));

    $result = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

    if ($result === FALSE) {
        logMsg("Curl Error: " . curl_error($ch));
        echo json_encode(["error" => "FCM Send Failed"]);
    } else {
        logMsg("FCM Response ($httpCode): " . $result);
        echo $result;
    }
    curl_close($ch);

} catch (Exception $e) {
    logMsg("V1 Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(["error" => $e->getMessage()]);
}
?>