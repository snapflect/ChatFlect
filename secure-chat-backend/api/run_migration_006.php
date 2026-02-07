<?php
require 'db.php';
$sql = file_get_contents('../migrations/006_add_signing_key.sql');
$conn->query($sql);
echo "Migration 006 run.";
