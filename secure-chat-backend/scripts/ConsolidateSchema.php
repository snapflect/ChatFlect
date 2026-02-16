<?php
// scripts/ConsolidateSchema.php
// Merges all migrations into a single SQL file for easy Restore.

$migrationDir = __DIR__ . '/../migrations';
$outputFile = __DIR__ . '/../latest_schema_complete.sql';

$files = glob($migrationDir . '/*.sql');
natsort($files); // Sort by number (001, 002, ... 100)

$handle = fopen($outputFile, 'w');
fwrite($handle, "-- ChatFlect Complete Schema (Generated " . date('Y-m-d H:i:s') . ")\n");
fwrite($handle, "-- Version: v15.0 (RC1)\n\n");

foreach ($files as $file) {
    $filename = basename($file);
    // Skip old snapshots if we are building from scratch, OR just include everything if they are incremental.
    // Assuming 001..108 are distinct and incremental.
    // We should skip 'full_schema*' files to avoid duplication if they are in the same folder.
    if (strpos($filename, 'full_schema') !== false) {
        continue;
    }

    echo "Merging: $filename\n";
    fwrite($handle, "\n-- \n-- SOURCE: $filename\n-- \n\n");
    fwrite($handle, file_get_contents($file));
    fwrite($handle, "\n;"); // Safety semi-colon
}

fclose($handle);
echo "\n✅ Successfully generated: latest_schema_complete.sql\n";
?>