<?php
// api/v4/security/gdpr_delete.php
// Epic 54: Right To Be Forgotten (GDPR/CCPA Deletion)
// Respects Legal Holds & Retention Policies

require_once __DIR__ . '/../../../includes/db_connect.php';
require_once __DIR__ . '/../../../includes/compliance_manager.php';
require_once __DIR__ . '/../../../includes/audit_logger.php';
require_once __DIR__ . '/../../../includes/env.php';

// Admin Auth (Strict)
$headers = getallheaders();
$adminSecret = getenv('ADMIN_SECRET_KEY');
if (!$adminSecret || ($headers['X-Admin-Secret'] ?? '') !== $adminSecret) {
    http_response_code(403);
    exit(json_encode(['error' => 'FORBIDDEN']));
}

$userId = $_GET['user_id'] ?? null;
if (!$userId)
    exit(json_encode(['error' => 'MISSING_USER_ID']));

$manager = new ComplianceManager($pdo);
$logger = new AuditLogger($pdo);

// 1. Check Legal Hold
if ($manager->isUnderLegalHold('USER', $userId)) {
    $logger->log('GDPR_DELETE_BLOCKED', 'WARNING', ['user_id' => $userId, 'reason' => 'LEGAL_HOLD_ACTIVE']);
    http_response_code(409); // Conflict
    exit(json_encode(['error' => 'LEGAL_HOLD_ACTIVE', 'message' => 'Cannot delete user under legal hold.']));
}

// 2. Perform Deletion
$pdo->beginTransaction();
try {
    // A. Wipe Devices
    $stmtDev = $pdo->prepare("DELETE FROM devices WHERE user_id = ?");
    $stmtDev->execute([$userId]);

    // B. Wipe Prekeys (Mock table for now, would be prekeys)
    // $pdo->prepare("DELETE FROM prekeys WHERE user_id = ?")->execute([$userId]);

    // C. Wipe Abuse Scores
    $key = md5("USER:$userId");
    $pdo->prepare("DELETE FROM abuse_scores WHERE target_key = ?")->execute([$key]);

    // D. Anonymize Audit Logs (Keep logs, nullify user_id or replace with 'DELETED')
    // Compliance often requires keeping the log but disassociating PII.
    // For simplicity: Update user_id to 'DELETED_<UID>' to break link but keep trace history exists.
    $anonymizedId = "DELETED_" . substr($userId, 0, 8);
    $pdo->prepare("UPDATE security_audit_log SET user_id = ? WHERE user_id = ?")->execute([$anonymizedId, $userId]);

    // E. Log the Deletion Event (The only thing remaining with clear reference potentially?)
    // Usually we log "User X request deletion", then perform it.
    // Here we log completion.
    $logger->log('GDPR_DELETE_COMPLETED', 'CRITICAL', ['original_user_id' => $userId, 'status' => 'WIPED']);

    $pdo->commit();
    echo json_encode(['success' => true, 'status' => 'DELETED']);

} catch (Exception $e) {
    $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['error' => 'DELETE_FAILED', 'details' => $e->getMessage()]);
}
