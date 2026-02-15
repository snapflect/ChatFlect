<?php
// scripts/validate_fk_types.php
// Scans migration files for Foreign Key type mismatches against 'users(user_id)'

$migrationsDir = __DIR__ . '/../migrations';
$files = glob($migrationsDir . '/*.sql');
$errors = [];

echo "🔍 Scanning " . count($files) . " migration files for FK mismatches...\n";

foreach ($files as $file) {
    $content = file_get_contents($file);
    $basename = basename($file);

    // Find all columns referencing users(user_id)
    // Pattern: FOREIGN KEY (`col_name`) REFERENCES `users`(`user_id`)
    if (preg_match_all('/FOREIGN KEY \(`(\w+)`\) REFERENCES `users`\(`user_id`\)/', $content, $matches)) {
        foreach ($matches[1] as $colName) {
            // Check definition of this column
            // Look for `col_name` INT or `col_name` BIGINT
            if (preg_match("/`$colName`\s+(INT|BIGINT|TINYINT|SMALLINT)/i", $content)) {
                $errors[] = "❌ $basename: Column `$colName` is defined as Integer but references users(user_id) [VARCHAR].";
            }
        }
    }
}

if (count($errors) > 0) {
    echo "\n⚠️ Found " . count($errors) . " potential issues:\n";
    foreach ($errors as $err) {
        echo $err . "\n";
    }
    exit(1);
} else {
    echo "\n✅ No INT -> VARCHAR FK mismatches found in migrations.\n";
    exit(0);
}
?>