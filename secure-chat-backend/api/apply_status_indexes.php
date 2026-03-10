<?php
require 'db.php';

echo "Applying missing Status DB indexes...\n";

try {
    $conn->query("CREATE INDEX idx_status_created ON status_updates (created_at)");
    echo "Index idx_status_created applied.\n";
} catch (Exception $e) {
    echo "Index idx_status_created might already exist: " . $e->getMessage() . "\n";
}

try {
    $conn->query("CREATE INDEX idx_status_user_created ON status_updates (user_id, created_at)");
    echo "Index idx_status_user_created applied.\n";
} catch (Exception $e) {
    echo "Index idx_status_user_created might already exist: " . $e->getMessage() . "\n";
}

echo "Done.\n";
?>