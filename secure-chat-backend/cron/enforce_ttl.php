<?php
// cron/enforce_ttl.php
// Epic 70: Daily/Hourly TTL Enforcement

require_once __DIR__ . '/../includes/ttl_enforcer.php';

$enforcer = new TTLEnforcer($pdo);
$enforcer->runBatch(1000); // Process 1000 items per run
