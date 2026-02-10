<?php
/**
 * SMTP Email Debug Script
 * Access this file directly in browser to test email sending
 * DELETE THIS FILE AFTER DEBUGGING
 */

header('Content-Type: text/plain');

echo "=== SMTP Email Debug ===\n\n";

// 1. Check if vendor/autoload exists
$autoloadPath = __DIR__ . '/../vendor/autoload.php';
echo "1. Checking autoload path: $autoloadPath\n";
if (file_exists($autoloadPath)) {
    echo "   ✓ autoload.php EXISTS\n\n";
} else {
    echo "   ✗ autoload.php NOT FOUND!\n\n";
    echo "   Checking alternative paths...\n";

    // Try other paths
    $paths = [
        __DIR__ . '/vendor/autoload.php',
        dirname(__DIR__) . '/vendor/autoload.php',
        $_SERVER['DOCUMENT_ROOT'] . '/vendor/autoload.php'
    ];
    foreach ($paths as $p) {
        echo "   - $p: " . (file_exists($p) ? "EXISTS" : "not found") . "\n";
    }
    exit;
}

// 2. Load autoload
try {
    require_once $autoloadPath;
    echo "2. Autoload loaded successfully\n\n";
} catch (Exception $e) {
    echo "2. Autoload ERROR: " . $e->getMessage() . "\n\n";
    exit;
}

// 3. Check if PHPMailer class exists
echo "3. Checking PHPMailer class...\n";
if (class_exists('PHPMailer\PHPMailer\PHPMailer')) {
    echo "   ✓ PHPMailer class EXISTS\n\n";
} else {
    echo "   ✗ PHPMailer class NOT FOUND!\n";
    echo "   Checking vendor structure...\n";

    $phpmailerPath = __DIR__ . '/../vendor/phpmailer/phpmailer/PHPMailer.php';
    echo "   - PHPMailer.php path: $phpmailerPath\n";
    echo "   - File exists: " . (file_exists($phpmailerPath) ? "YES" : "NO") . "\n";
    exit;
}

// 4. Load config
echo "4. Loading email config...\n";
$configPath = __DIR__ . '/email_config.php';
if (!file_exists($configPath)) {
    echo "   ✗ email_config.php NOT FOUND at $configPath\n";
    exit;
}
$config = require $configPath;
echo "   SMTP Host: " . $config['smtp_host'] . "\n";
echo "   SMTP Port: " . $config['smtp_port'] . "\n";
echo "   SMTP User: " . $config['smtp_username'] . "\n";
echo "   From: " . $config['from_email'] . "\n\n";

// 5. Test sending email
echo "5. Attempting to send test email...\n\n";

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception;

try {
    $mail = new PHPMailer(true);

    // Enable verbose debug output
    $mail->SMTPDebug = SMTP::DEBUG_SERVER;
    $mail->Debugoutput = function ($str, $level) {
        echo "   [DEBUG $level] $str\n";
    };

    // SMTP Configuration
    $mail->isSMTP();
    $mail->Host = $config['smtp_host'];
    $mail->Port = $config['smtp_port'];
    $mail->SMTPSecure = $config['smtp_secure'];
    $mail->SMTPAuth = true;
    $mail->Username = $config['smtp_username'];
    $mail->Password = $config['smtp_password'];
    $mail->Timeout = 30;

    // Sender and recipient
    $mail->setFrom($config['from_email'], $config['from_name']);
    $mail->addAddress($config['smtp_username']); // Send to self for testing

    // Email content
    $mail->Subject = 'SMTP Test - ' . date('Y-m-d H:i:s');
    $mail->Body = 'This is a test email from SnapFlect SMTP debug script.';

    $mail->send();

    echo "\n\n=== SUCCESS ===\n";
    echo "Test email sent to: " . $config['smtp_username'] . "\n";
    echo "Check your inbox!\n";

} catch (Exception $e) {
    echo "\n\n=== FAILED ===\n";
    echo "Error: " . $mail->ErrorInfo . "\n";
}
?>