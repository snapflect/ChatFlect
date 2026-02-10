<?php
// debug_contact_search.php
// Version 6: Dump Table Content

require 'db.php';
header('Content-Type: text/plain');

echo "Start Debug 6.0 (Data Dump)\n";

if (!$conn)
    die("No DB Connection");

echo "--- DUMPING FIRST 50 USERS ---\n";

$sql = "SELECT phone_number FROM users LIMIT 50";
$res = $conn->query($sql);

if (!$res)
    die("Query Failed: " . $conn->error);

echo "Total Rows in DB: " . $res->num_rows . "\n\n";

while ($row = $res->fetch_assoc()) {
    $ph = $row['phone_number'];
    echo "Value: '$ph'\n";
    echo "Hex:   " . bin2hex($ph) . "\n";
    echo "Length:" . strlen($ph) . "\n";
    echo "-----------------\n";
}
?>