<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

header('Content-Type: application/json');

$results = [
    "file_check" => "pending",
    "permissions" => "pending",
    "json_parse" => "pending",
    "openssl_check" => "pending"
];

$file = 'service-account.json';

// 1. Check File Existence
if (file_exists($file)) {
    $results['file_check'] = "exists";

    // 2. Check Permissions
    if (is_readable($file)) {
        $results['permissions'] = "readable";

        // 3. Parse JSON
        $content = file_get_contents($file);
        $json = json_decode($content, true);

        if (json_last_error() === JSON_ERROR_NONE) {
            $results['json_parse'] = "valid";

            // 4. Check Key Structure
            if (isset($json['private_key']) && isset($json['client_email'])) {
                $results['key_structure'] = "valid";
                $results['client_email'] = $json['client_email'];

                // 5. Test OpenSSL
                if (function_exists('openssl_sign')) {
                    $results['openssl_check'] = "available";

                    // Try a dummy sign
                    $input = "test";
                    $privKey = $json['private_key'];

                    try {
                        if (openssl_sign($input, $signature, $privKey, 'SHA256')) {
                            $results['signing_test'] = "success";
                        } else {
                            $results['signing_test'] = "failed";
                            $results['openssl_error'] = openssl_error_string();
                        }
                    } catch (Exception $e) {
                        $results['signing_test'] = "exception: " . $e->getMessage();
                    }

                } else {
                    $results['openssl_check'] = "missing_function";
                }

                // 6. Test Connectivity (cURL)
                $ch = curl_init();
                curl_setopt($ch, CURLOPT_URL, 'https://oauth2.googleapis.com/token');
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false); // Debug only
                $resp = curl_exec($ch);
                if ($resp === false) {
                    $results['curl_test'] = "failed: " . curl_error($ch);
                } else {
                    $results['curl_test'] = "success (HTTP " . curl_getinfo($ch, CURLINFO_HTTP_CODE) . ")";
                }
                curl_close($ch);

            } else {
                $results['key_structure'] = "missing_keys";
            }
        } else {
            $results['json_parse'] = "error: " . json_last_error_msg();
        }
    } else {
        $results['permissions'] = "not_readable";
    }
} else {
    $results['file_check'] = "not_found";
}

echo json_encode($results, JSON_PRETTY_PRINT);
?>