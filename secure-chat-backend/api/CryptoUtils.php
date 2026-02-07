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
}
