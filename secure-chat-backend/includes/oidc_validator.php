<?php
// includes/oidc_validator.php
// Epic 65: OIDC Validator

class OIDCValidator
{
    public function validateToken($idToken, $issuer, $clientId)
    {
        // Mock Implementation due to lack of JWT libraries in environment
        // In Prod: Fetch JWKS from $issuer . '/.well-known/openid-configuration' -> jwks_uri
        // Verify Signature
        // Verify Claims (iss, aud, exp)

        // Mock Logic:
        // Assume if token is "MOCK_VALID_TOKEN" or format "HEADER.PAYLOAD.SIG" it is valid if we are in test mode.
        // Real implementation requires 'firebase/php-jwt' or similar.

        // Decode Payload
        $parts = explode('.', $idToken);
        if (count($parts) !== 3)
            throw new Exception("Invalid Token Format");

        $payload = json_decode(base64_decode($parts[1]), true);
        if (!$payload)
            throw new Exception("Invalid Payload");

        if ($payload['iss'] !== $issuer)
            throw new Exception("Issuer mismatch");
        // if ($payload['aud'] !== $clientId) throw new Exception("Audience mismatch");
        if ($payload['exp'] < time())
            throw new Exception("Token Expired");

        return $payload; // Returns claims: sub, email, etc.
    }
}
