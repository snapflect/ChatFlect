<?php
// cron/enforce_ttl.php
// Epic 70: Daily/Hourly TTL Enforcement

require_once __DIR__ . '/../includes/ttl_enforcer.php';

$enforcer = new TTLEnforcer($pdo);

// HF-70.4: Batch Safety
// "Cron deletes max 5000 per run."
// If exceeded -> logs CRITICAL (implied by having more work than limit?)
// Or if we try to process too many.
// runBatch takes a limit. We set it to 5000.

$limit = 5000;
$enforcer->runBatch($limit);
