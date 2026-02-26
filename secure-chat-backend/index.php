<?php
header("Content-Type: application/json");
echo json_encode([
    "service" => "ChatFlect API",
    "status" => "online",
    "version" => "v2.3-hardened",
    "documentation" => "/api/diag_logs.php"
]);
?>