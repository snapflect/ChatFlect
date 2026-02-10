<?php
// includes/keys/server_key_gen.php
// Helper to generate keys if they don't exist
$keyDir = __DIR__;
if (!file_exists("$keyDir/private.pem")) {
    $res = openssl_pkey_new([
        "private_key_bits" => 2048,
        "private_key_type" => OPENSSL_KEYTYPE_RSA,
    ]);
    openssl_pkey_export($res, $privKey);
    file_put_contents("$keyDir/private.pem", $privKey);
    $pubKey = openssl_pkey_get_details($res);
    file_put_contents("$keyDir/public.pem", $pubKey["key"]);
}
