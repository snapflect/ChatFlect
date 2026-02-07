<?php
require_once 'api/CryptoUtils.php';
// Trigger key generation
$pubKey = CryptoUtils::getPublicKey();
echo "PUBLIC_KEY_START\n" . $pubKey . "\nPUBLIC_KEY_END";
