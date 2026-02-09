<?php
// scripts/audit_feature_gates.php
// Epic 68 HF: Static Audit
// Scans API files to ensure they implement Feature Gate checks.

$dir = __DIR__ . '/../api/v4';
$rii = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir));

$files = [];
foreach ($rii as $file) {
    if ($file->isDir()) {
        continue;
    }
    if ($file->getExtension() === 'php') {
        $files[] = $file->getPathname();
    }
}

$errors = 0;

echo "Scanning " . count($files) . " files for FeatureGate...\n";

foreach ($files as $file) {
    $content = file_get_contents($file);

    // Heuristic: If file allows "org" actions but doesn't check FeatureGate?
    // Not all APIs need feature gates (some are basic).
    // Let's look for known "Premium" keywords or specific files.

    // Better heuristic for this task: Ensure specific high-value APIs call FeatureGate.
    // e.g., export_*, sso/*, scim/*

    $checkNeeded = false;
    if (strpos($file, 'export_') !== false)
        $checkNeeded = true;
    if (strpos($file, 'sso/') !== false)
        $checkNeeded = true;
    if (strpos($file, 'scim/') !== false)
        $checkNeeded = true;

    if ($checkNeeded) {
        if (strpos($content, 'FeatureGate::require') === false && strpos($content, 'FeatureGate') === false) {
            echo "ERROR: File '$file' seems to protect a Premium feature but lacks FeatureGate check.\n";
            $errors++;
        }
    }
}

if ($errors > 0) {
    echo "Audit FAILED: $errors potential security gaps found.\n";
    exit(1);
} else {
    echo "Audit PASSED.\n";
    exit(0);
}
