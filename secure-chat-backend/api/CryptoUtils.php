<?php
/**
 * CryptoUtils.php
 * Backend Cryptography Services for ChatFlect v2.0
 * Handles Key Bundle Signing and Verification
 */

class CryptoUtils
{
    private static $KEY_FILE = __DIR__ . '/../keys/backend_identity.pem';
    private static $PUB_KEY_FILE = __DIR__ . '/../keys/backend_identity.pub.pem';

    /**
     * Get or Generate Backend Signing Key
     * In production, this should come from a secure HSM or Secrets Manager.
     */
    public static function getPrivateKey()
    {
        if (!file_exists(dirname(self::$KEY_FILE))) {
            mkdir(dirname(self::$KEY_FILE), 0700, true);
        }

        if (!file_exists(self::$KEY_FILE)) {
            // Generate new RSA-2048 Key
            $config = array(
                "digest_alg" => "sha256",
                "private_key_bits" => 2048,
                "private_key_type" => OPENSSL_KEYTYPE_RSA,
            );
            $res = openssl_pkey_new($config);
            openssl_pkey_export($res, $privKey);
            file_put_contents(self::$KEY_FILE, $privKey);

            $details = openssl_pkey_get_details($res);
            file_put_contents(self::$PUB_KEY_FILE, $details['key']);
        }

        return file_get_contents(self::$KEY_FILE);
    }

    public static function getPublicKey()
    {
        if (!file_exists(self::$PUB_KEY_FILE)) {
            self::getPrivateKey(); // Generates both
        }
        return file_get_contents(self::$PUB_KEY_FILE);
    }

    /**
     * Sign Canonical Payload
     * Algorithm: SHA256withRSA
     */
    public static function signPayload($data)
    {
        $privateKey = self::getPrivateKey();
        $binarySignature = '';
        openssl_sign($data, $binarySignature, $privateKey, OPENSSL_ALGO_SHA256);
        return bin2hex($binarySignature);
    }

    /**
     * Verify Signature (for testing/debug)
     */
    public static function verifySignature($data, $hexSignature)
    {
        $publicKey = self::getPublicKey();
        $binarySignature = hex2bin($hexSignature);
        return openssl_verify($data, $binarySignature, $publicKey, OPENSSL_ALGO_SHA256) === 1;
    }

    /**
     * Create Canonical String for Key Bundle
     */
    public static function createCanonicalString($userId, $deviceUuid, $publicKey, $timestamp, $version)
    {
        // Format: user_id|device_uuid|public_key|timestamp|version
        // Newlines stripped from public key to ensure consistency
        $cleanKey = str_replace(["\r", "\n", "-----BEGIN PUBLIC KEY-----", "-----END PUBLIC KEY-----"], "", $publicKey);
        $cleanKey = trim($cleanKey);

        return sprintf(
            "%s|%s|%s|%s|%d",
            $userId,
            $deviceUuid,
            $cleanKey,
            $timestamp,
            $version
        );
    }

    /**
     * Verify Signal Protocol Signature (Ed25519)
     * Used for SignedPreKeys and Rotation Requests
     */
    public static function verifySignalSignature($identityKeyBase64, $dataBase64, $signatureBase64)
    {
        // LibSignal Keys are raw bytes (Base64 encoded)
        // Need sodium extension for Ed25519
        if (!function_exists('sodium_crypto_sign_verify_detached')) {
            error_log("CRITICAL: Sodium extension parsing missing. Cannot verify Signal Signatures.");
            return false;
        }

        try {
            $identityKey = self::base64ToBinary($identityKeyBase64);
            $data = self::base64ToBinary($dataBase64); // The SignedPreKey Public Key
            $signature = self::base64ToBinary($signatureBase64);

            // Signal Identity Keys often have a 0x05 prefix (DJB Curve25519) -> Ed25519?
            // Actually SignedPreKey signing uses the Identity Key directly.
            // If it's X33519 it needs conversion, but Signal usually keeps Identity as Signing Capable (Ed25519).
            // NOTE: LibSignal-TypeScript Identity Keys are 33 bytes (0x05 + 32 bytes).
            // Sodium expects 32 bytes. We might need to strip the prefix.
            if (strlen($identityKey) === 33 && ord($identityKey[0]) === 5) {
                $identityKey = substr($identityKey, 1);
            }

            return sodium_crypto_sign_verify_detached($signature, $data, $identityKey);

        } catch (Exception $e) {
            error_log("Signature Verification Exception: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Verify Signal Protocol Signature (Ed25519) - RAW DATA
     * Used for Request Body Verification (X-Signal-Signature)
     */
    public static function verifySignalSignatureRaw($identityKeyBase64, $rawData, $signatureBase64)
    {
        if (!function_exists('sodium_crypto_sign_verify_detached')) {
            error_log("CRITICAL: Sodium extension parsing missing.");
            return false;
        }

        try {
            $identityKey = self::base64ToBinary($identityKeyBase64);
            $signature = self::base64ToBinary($signatureBase64);
            // $rawData is ALREADY binary/string. Do not decode it.

            // Handle 33-byte Identity Key prefix (0x05)
            if (strlen($identityKey) === 33 && ord($identityKey[0]) === 5) {
                $identityKey = substr($identityKey, 1);
            }

            return sodium_crypto_sign_verify_detached($signature, $rawData, $identityKey);

        } catch (Exception $e) {
            error_log("Raw Signature Verification Exception: " . $e->getMessage());
            return false;
        }
    }

    private static function base64ToBinary($input)
    {
        // Handle URL safe replacements if needed, but standard B64 usually.
        return base64_decode($input);
    }
}
