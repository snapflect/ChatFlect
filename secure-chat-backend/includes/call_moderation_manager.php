<?php
// includes/call_moderation_manager.php
// Epic 77: Call Moderation Logic

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/call_session_manager.php';

class CallModerationManager
{
    private $pdo;

    public function __construct($pdo)
    {
        $this->pdo = $pdo;
    }

    public function forceEndCall($adminId, $callId, $reason)
    {
        // Verify Admin Role (Mock)
        if (!$this->isAdmin($adminId)) {
            throw new Exception("Unauthorized");
        }

        // HF-77.3: Rate limiting (5 force-ends/hour)
        if (!$this->checkAdminRateLimit($adminId, 'FORCE_END', 5)) {
            throw new Exception("Rate limit exceeded for Force End actions.");
        }

        // HF-77.1: Governance Approval (Mock)
        // In prod, check table `governance_approvals` for ticket_id linked to this action
        // if (!$this->hasGovernanceApproval($adminId, 'FORCE_END')) ...

        $csm = new CallSessionManager($this->pdo);
        $csm->endCall(bin2hex($callId), $adminId, "FORCE_END: $reason");

        $this->logAction($callId, $adminId, 'FORCE_END', null, null, $reason);
    }

    public function kickParticipant($adminId, $callId, $targetUserId, $deviceId, $reason)
    {
        if (!$this->isAdmin($adminId)) {
            throw new Exception("Unauthorized");
        }

        // HF-77.3: Rate limiting (10 kicks/hour)
        if (!$this->checkAdminRateLimit($adminId, 'KICK_DEVICE', 10)) {
            throw new Exception("Rate limit exceeded for Kick actions.");
        }

        $callIdBin = $callId; // Assuming binary input for internal tools? Or consistent usage.
        // Let's assume input is BINARY for internal calls, or handle hex conversion.
        // Consistent: Inputs are usually Hex strings from API.

        // Revoke from participants
        $stmt = $this->pdo->prepare("UPDATE call_participants SET status='REVOKED', left_at=NOW() WHERE call_id = ? AND user_id = ? AND device_id = ?");
        $stmt->execute([$callId, $targetUserId, $deviceId]);

        $this->logAction($callId, $adminId, 'KICK_DEVICE', $targetUserId, $deviceId, $reason);
    }

    private function checkAdminRateLimit($adminId, $action, $limit)
    {
        $stmt = $this->pdo->prepare("SELECT COUNT(*) FROM call_moderation_events WHERE moderator_user_id = ? AND action = ? AND created_at > NOW() - INTERVAL 1 HOUR");
        $stmt->execute([$adminId, $action]);
        return $stmt->fetchColumn() < $limit;
    }

    private function logAction($callId, $modId, $action, $targetUser, $targetDevice, $reason)
    {
        $timestamp = time();

        // HF-77.4: Privacy Masking on Target Device ID in Reason/Details if logged?
        // Actually, target_device_id column is structured.
        // We mask it in the "Reason" if it was concatenated, or just ensure
        // logs displayed to lower-level admins are masked.
        // For DB storage, we store RAW for audit.
        // The "Export" function handles masking.

        $payload = "MOD:$callId:$modId:$action:$timestamp";

        // Sign
        $privateKeyPath = __DIR__ . '/../../keys/server_private.pem';
        $signature = '';
        if (file_exists($privateKeyPath)) {
            $pkey = openssl_pkey_get_private(file_get_contents($privateKeyPath));
            openssl_sign($payload, $rawSig, $pkey, OPENSSL_ALGO_SHA256);
            $signature = base64_encode($rawSig);
        }

        $stmt = $this->pdo->prepare("INSERT INTO call_moderation_events (call_id, moderator_user_id, action, target_user_id, target_device_id, reason, signature) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([$callId, $modId, $action, $targetUser, $targetDevice, $reason, $signature]);
    }

    private function isAdmin($userId)
    {
        return true; // Mock
    }
}
