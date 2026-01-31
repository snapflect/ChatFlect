<?php
/**
 * Simple autoloader for PHPMailer (when Composer is not available)
 */
spl_autoload_register(function ($class) {
    // PHPMailer namespace prefix
    $prefix = 'PHPMailer\\PHPMailer\\';

    // base directory for PHPMailer
    $base_dir = __DIR__ . '/phpmailer/phpmailer/';

    // Check if the class uses the namespace prefix
    $len = strlen($prefix);
    if (strncmp($prefix, $class, $len) !== 0) {
        return;
    }

    // Get the relative class name
    $relative_class = substr($class, $len);

    // Replace namespace separators with directory separators
    $file = $base_dir . str_replace('\\', '/', $relative_class) . '.php';

    // If the file exists, require it
    if (file_exists($file)) {
        require $file;
    }
});
?>