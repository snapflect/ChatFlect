<?php
/**
 * SimpleJWT
 * A dependency-free helper to sign JWTs with RS256 (OpenSSL).
 * Required for Firebase Custom Tokens without Composer.
 */

class SimpleJWT
{

    /**
     * Generate a Firebase Custom Token
     * 
     * @param string $serviceAccountEmail The client_email from service-account.json
     * @param string $privateKey The private_key from service-account.json
     * @param string $uid The user ID to authenticate
     * @param array $claims Optional additional claims
     * @return string The signed JWT
     */
    public static function createCustomToken($serviceAccountEmail, $privateKey, $uid, $claims = [])
    {
        $now = time();
        $header = [
            'alg' => 'RS256',
            'typ' => 'JWT'
        ];

        $payload = array_merge([
            'iss' => $serviceAccountEmail,
            'sub' => $serviceAccountEmail,
            'aud' => 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
            'iat' => $now,
            'exp' => $now + 3600, // 1 hour expiration
            'uid' => $uid,
            'claims' => $claims // "claims" is where custom data goes for custom tokens
        ], []);

        $base64UrlHeader = self::base64UrlEncode(json_encode($header));
        $base64UrlPayload = self::base64UrlEncode(json_encode($payload));

        $signatureInput = $base64UrlHeader . "." . $base64UrlPayload;

        $signature = '';
        if (!openssl_sign($signatureInput, $signature, $privateKey, "SHA256")) {
            throw new Exception("OpenSSL signing failed.");
        }

        $base64UrlSignature = self::base64UrlEncode($signature);

        return $signatureInput . "." . $base64UrlSignature;
    }

    private static function base64UrlEncode($data)
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }
}
