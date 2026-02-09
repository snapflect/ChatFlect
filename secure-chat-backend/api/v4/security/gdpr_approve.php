<?php
// api/v4/security/gdpr_approve.php
// Epic 54 Hardening: Two-Man Rule for Deletion
// Secondary admin approval endpoint.

require_once __DIR__ . '/../../../includes/db_connect.php';
require_once __DIR__ . '/../../../includes/env.php';
require_once __DIR__ . '/../../../includes/audit_logger.php';

header('Content-Type: application/json');

// 1. Primary Admin Auth
$headers = getallheaders();
$adminSecret = getenv('ADMIN_SECRET_KEY');
if (!$adminSecret || ($headers['X-Admin-Secret'] ?? '') !== $adminSecret) {
    http_response_code(403);
    echo json_encode(['error' => 'FORBIDDEN']);
    exit;
}

// 2. Secondary Admin Auth (Mock - In real world, different token/user)
// For simulation: Require 'X-Secondary-Admin-Secret' header
$secondarySecret = getenv('SECONDARY_ADMIN_SECRET_KEY') ?: 'mock_secondary_secret';
if (($headers['X-Secondary-Admin-Secret'] ?? '') !== $secondarySecret) {
    http_response_code(401);
    echo json_encode(['error' => 'SECONDARY_APPROVAL_REQUIRED', 'message' => 'Two-Man Rule: Missing valid secondary admin token']);
    exit;
}

$jobId = $_GET['job_id'] ?? null;
if (!$jobId) {
    http_response_code(400);
    echo json_encode(['error' => 'MISSING_JOB_ID']);
    exit;
}

// 3. Approve Job
$pdo->prepare("UPDATE gdpr_delete_jobs SET status = 'APPROVED' WHERE job_id = ? AND status = 'PENDING_APPROVAL'")->execute([$jobId]);
if ($pdo->rowCount() > 0) {
    $logger = new AuditLogger($pdo);
    $logger->log('GDPR_DUAL_AUTH_APPROVED', 'CRITICAL', ['job_id' => $jobId]);
    echo json_encode(['success' => true, 'status' => 'APPROVED']);
} else {
    echo json_encode(['error' => 'JOB_NOT_FOUND_OR_INVALID_STATE']);
}
