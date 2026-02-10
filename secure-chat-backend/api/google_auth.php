<?php
// api/google_auth.php
// Helper to get Google OAuth Access Token for Firestore/FCM

function getAccessToken($serviceAccountPath)
{
    if (!file_exists($serviceAccountPath))
        return ["error" => "Service account file not found: $serviceAccountPath"];

    $keys = json_decode(file_get_contents($serviceAccountPath), true);
    if (!$keys)
        return ["error" => "Invalid service account JSON"];

    function urlSafeBase64Encode($data)
    {
        return str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($data));
    }

    $jwtHeader = urlSafeBase64Encode(json_encode(['alg' => 'RS256', 'typ' => 'JWT']));
    $now = time();
    $jwtClaim = urlSafeBase64Encode(json_encode([
        'iss' => $keys['client_email'],
        'scope' => 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/firebase.messaging',
        'aud' => 'https://oauth2.googleapis.com/token',
        'exp' => $now + 3600,
        'iat' => $now
    ]));

    // Sign
    $input = "$jwtHeader.$jwtClaim";
    $privateKey = $keys['private_key'];
    openssl_sign($input, $signature, $privateKey, 'SHA256');
    $jwtSignature = urlSafeBase64Encode($signature);
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

    // DEBUG: Disable SSL only if absolutely necessary for local dev
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
