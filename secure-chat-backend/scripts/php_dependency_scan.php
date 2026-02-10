<?php
// scripts/php_dependency_scan.php
// Epic 40: PHP Dependency Security Scan

echo "=== PHP Dependency Scan ===\n\n";

$issues = [];
$warnings = [];

// 1. Check for known insecure patterns
$insecurePatterns = [
    'mysql_query' => 'Use PDO or mysqli instead of deprecated mysql_* functions',
    'mysql_connect' => 'Use PDO or mysqli instead of deprecated mysql_* functions',
    'eval(' => 'Avoid eval() - code injection risk',
    'exec(' => 'Review exec() usage for command injection',
    'shell_exec(' => 'Review shell_exec() for command injection',
    'system(' => 'Review system() for command injection',
    'passthru(' => 'Review passthru() for command injection',
    'md5(' => 'MD5 is weak for passwords - use password_hash()',
    'sha1(' => 'SHA1 is weak for passwords - use password_hash()',
    'base64_decode($_' => 'Potential code injection via base64',
    'serialize($_' => 'Unserialize user input is dangerous',
];

// Directories to scan
$scanDirs = [
    __DIR__ . '/../api',
    __DIR__ . '/../includes',
    __DIR__ . '/../relay',
];

echo "Scanning for insecure patterns...\n";

foreach ($scanDirs as $dir) {
    if (!is_dir($dir))
        continue;

    $files = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($dir)
    );

    foreach ($files as $file) {
        if ($file->getExtension() !== 'php')
            continue;

        $content = file_get_contents($file->getPathname());
        $relativePath = str_replace(__DIR__ . '/../', '', $file->getPathname());

        foreach ($insecurePatterns as $pattern => $message) {
            if (strpos($content, $pattern) !== false) {
                $warnings[] = "$relativePath: $pattern - $message";
            }
        }
    }
}

// 2. Check for vendor directory (should use Composer properly)
if (is_dir(__DIR__ . '/../vendor')) {
    $composerLock = __DIR__ . '/../composer.lock';
    if (!file_exists($composerLock)) {
        $issues[] = 'vendor/ exists but composer.lock missing - dependencies untracked';
    }
}

// 3. Check for manually copied libraries
$suspiciousFiles = glob(__DIR__ . '/../includes/*.class.php');
if (!empty($suspiciousFiles)) {
    $warnings[] = 'Found .class.php files - ensure these are not outdated vendor copies';
}

// Report
echo "\n";
if (empty($issues) && empty($warnings)) {
    echo "✅ No security issues found\n";
    exit(0);
}

if (!empty($warnings)) {
    echo "⚠️  WARNINGS (" . count($warnings) . "):\n";
    foreach ($warnings as $w) {
        echo "  - $w\n";
    }
}

if (!empty($issues)) {
    echo "\n❌ ISSUES (" . count($issues) . "):\n";
    foreach ($issues as $i) {
        echo "  - $i\n";
    }
    exit(1);
}

echo "\n✅ Scan complete (warnings only)\n";
exit(0);
