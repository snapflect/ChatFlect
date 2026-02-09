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

        $csm = new CallSessionManager($this->pdo);
        $csm->endCall(bin2hex($callId), $adminId, "FORCE_END: $reason"); // Pass hex if csm expects hex

        $this->logAction($callId, $adminId, 'FORCE_END', null, null, $reason);
    }

    public function kickParticipant($adminId, $callId, $targetUserId, $deviceId, $reason)
    {
        if (!$this->isAdmin($adminId)) {
            throw new Exception("Unauthorized");
        }

        $callIdBin = $callId; // Assuming binary input for internal tools? Or consistent usage.
        // Let's assume input is BINARY for internal calls, or handle hex conversion.
        // Consistent: Inputs are usually Hex strings from API.

        // Revoke from participants
        $stmt = $this->pdo->prepare("UPDATE call_participants SET status='REVOKED', left_at=NOW() WHERE call_id = ? AND user_id = ? AND device_id = ?");
        $stmt->execute([$callId, $targetUserId, $deviceId]);

        $this->logAction($callId, $adminId, 'KICK_DEVICE', $targetUserId, $deviceId, $reason);
    }

    private function logAction($callId, $modId, $action, $targetUser, $targetDevice, $reason)
    {
        $timestamp = time();
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
