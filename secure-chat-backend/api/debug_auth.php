<?php
/**
 * Debug Auth Script
 * Verifies environment for Firebase Custom Auth
 */

error_reporting(E_ALL);
ini_set('display_errors', 1);
header('Content-Type: text/plain');

echo "=== Firebase Custom Auth Debugger ===\n";

// 1. Check OpenSSL
echo "\n1. Checking OpenSSL...\n";
if (extension_loaded('openssl')) {
    echo "PASS: OpenSSL extension is loaded.\n";
} else {
    echo "FAIL: OpenSSL extension is MISSING. Enable it in php.ini.\n";
}

// 2. Check Service Account File
echo "\n2. Checking Service Account File...\n";
$keyPath = __DIR__ . '/service-account.json';
if (file_exists($keyPath)) {
    echo "PASS: File found at $keyPath\n";

    // Check Permissions
    if (is_readable($keyPath)) {
        echo "PASS: File is readable.\n";

        $content = file_get_contents($keyPath);
        $json = json_decode($content, true);

        if ($json) {
            echo "PASS: JSON is valid.\n";

            if (isset($json['client_email'])) {
                echo "PASS: client_email found: " . $json['client_email'] . "\n";
            } else {
                echo "FAIL: client_email missing in JSON.\n";
            }

            if (isset($json['private_key'])) {
                echo "PASS: private_key found (length: " . strlen($json['private_key']) . ")\n";

                // Test Key Usage
                echo "\n3. Testing Token Generation...\n";
                require_once 'SimpleJWT.php';

                try {
                    $token = SimpleJWT::createCustomToken(
                        $json['client_email'],
                        $json['private_key'],
                        'DEBUG_USER_123',
                        ['debug' => true]
                    );
                    echo "PASS: Token generated successfully!\n";
                    echo "Sample Token (First 50 chars): " . substr($token, 0, 50) . "...\n";
                } catch (Exception $e) {
                    echo "FAIL: Token generation threw exception: " . $e->getMessage() . "\n";
                }

            } else {
                echo "FAIL: private_key missing in JSON.\n";
            }

        } else {
            echo "FAIL: JSON decode failed. Error: " . json_last_error_msg() . "\n";
        }
    } else {
        echo "FAIL: File is NOT readable (Check permissions, e.g., chmod 644).\n";
    }
} else {
    echo "FAIL: service-account.json NOT found in " . __DIR__ . "\n";
}

echo "\n=== End Debug ===";
