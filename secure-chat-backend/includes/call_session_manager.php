<?php
// includes/call_session_manager.php
// Epic 76: Call Lifecycle Logic

require_once __DIR__ . '/db_connect.php';

class CallSessionManager
{
    private $pdo;

    public function __construct($pdo)
    {
        $this->pdo = $pdo;
    }

    public function createCall($initiatorId, $callId)
    {
        $callIdBin = hex2bin($callId);
        $stmt = $this->pdo->prepare("INSERT INTO calls (call_id, initiator_user_id, status) VALUES (?, ?, 'INIT')");
        $stmt->execute([$callIdBin, $initiatorId]);
    }

    public function joinCall($callId, $userId, $deviceId)
    {
        $callIdBin = hex2bin($callId);

        // HF-76.3: Check Lockdown
        if ($this->isLockedDown($callIdBin)) {
            $this->logEvent($callIdBin, $userId, $deviceId, 'JOIN_FAILED', 'Call Locked Down');
            throw new Exception("Call is temporarily locked due to excessive failures.");
        }

        // HF-76.1: Rate Limit (10 joins/min/device)
        if (!$this->checkJoinRateLimit($userId, $deviceId)) {
            $this->logEvent($callIdBin, $userId, $deviceId, 'JOIN_FAILED', 'Rate Limit Exceeded');
            throw new Exception("Too many join attempts. Please wait.");
        }

        // Check if Call Active or Init
        $stmt = $this->pdo->prepare("SELECT status FROM calls WHERE call_id = ?");
        $stmt->execute([$callIdBin]);
        $status = $stmt->fetchColumn();

        if (!$status || $status === 'ENDED') {
            $this->logEvent($callIdBin, $userId, $deviceId, 'JOIN_FAILED', 'Call Not Active');
            throw new Exception("Call not active");
        }

        try {
            // Add/Update Participant
            $stmt = $this->pdo->prepare("
                INSERT INTO call_participants (call_id, user_id, device_id, status, joined_at) 
                VALUES (?, ?, ?, 'JOINED', NOW())
                ON DUPLICATE KEY UPDATE status='JOINED', joined_at=NOW(), left_at=NULL
            ");
            $stmt->execute([$callIdBin, $userId, $deviceId]);

            // Init Ratchet State
            $stmt = $this->pdo->prepare("
                INSERT INTO call_ratchet_state (call_id, user_id, device_id, current_ratchet_counter)
                VALUES (?, ?, ?, 0)
                ON DUPLICATE KEY UPDATE last_key_rotation_at=NOW()
            ");
            $stmt->execute([$callIdBin, $userId, $deviceId]);

            // If Init, switch to Active
            if ($status === 'INIT') {
                $update = $this->pdo->prepare("UPDATE calls SET status='ACTIVE' WHERE call_id = ?");
                $update->execute([$callIdBin]);
            }

            $this->logEvent($callIdBin, $userId, $deviceId, 'JOIN_SUCCESS');

        } catch (Exception $e) {
            // HF-76.3: Track Failures for Lockdown
            $this->incrementFailureCount($callIdBin);
            throw $e;
        }
    }

    // HF-76.1: Rate Limiting
    private function checkJoinRateLimit($userId, $deviceId)
    {
        $stmt = $this->pdo->prepare("SELECT COUNT(*) FROM call_audit_logs WHERE user_id = ? AND device_id = ? AND action IN ('JOIN_ATTEMPT', 'JOIN_SUCCESS') AND created_at > NOW() - INTERVAL 1 MINUTE");
        $stmt->execute([$userId, $deviceId]);
        return $stmt->fetchColumn() < 10;
    }

    // HF-76.3: Lockdown Logic
    private function isLockedDown($callIdBin)
    {
        $stmt = $this->pdo->prepare("SELECT locked_until FROM call_lockdowns WHERE call_id = ?");
        $stmt->execute([$callIdBin]);
        $lockedUntil = $stmt->fetchColumn();
        return $lockedUntil && strtotime($lockedUntil) > time();
    }

    private function incrementFailureCount($callIdBin)
    {
        $stmt = $this->pdo->prepare("
            INSERT INTO call_lockdowns (call_id, failure_count, last_failure_at) 
            VALUES (?, 1, NOW())
            ON DUPLICATE KEY UPDATE 
                failure_count = IF(last_failure_at > NOW() - INTERVAL 1 MINUTE, failure_count + 1, 1),
                last_failure_at = NOW()
        ");
        $stmt->execute([$callIdBin]);

        // Check trigger
        $stmt = $this->pdo->prepare("SELECT failure_count FROM call_lockdowns WHERE call_id = ?");
        $stmt->execute([$callIdBin]);
        if ($stmt->fetchColumn() >= 5) {
            $this->lockdownCall($callIdBin);
        }
    }

    private function lockdownCall($callIdBin)
    {
        $stmt = $this->pdo->prepare("UPDATE call_lockdowns SET locked_until = DATE_ADD(NOW(), INTERVAL 60 SECOND) WHERE call_id = ?");
        $stmt->execute([$callIdBin]);
    }

    public function logEvent($callIdBin, $userId, $deviceId, $action, $reason = null)
    {
        $stmt = $this->pdo->prepare("INSERT INTO call_audit_logs (call_id, user_id, device_id, action, reason) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([$callIdBin, $userId, $deviceId, $action, $reason]);
    }

    public function endCall($callId, $userId, $reason = 'HANGUP')
    {
        $callIdBin = hex2bin($callId);
        // Only verify if user is participant?
        // Or if user is initiator?
        // Usually anyone can leave, but last one ends it?
        // Let's assume explicit End Call command ends it for CURRENT DEVICE or ALL?
        // "End Call" usually means "I leave". If last one, session ends.
        // For Epic, let's assume "Terminate Session".

        $stmt = $this->pdo->prepare("UPDATE calls SET status='ENDED', ended_at=NOW(), end_reason = ? WHERE call_id = ?");
        $stmt->execute([$reason, $callIdBin]);

        // HF-76.5: Secure Delete Ratchet State
        // Overwrite counters/keys before delete (Cyber Shred)
        // Since we don't store KEYS (only counters), we just delete rows.
        // But if we stored keys, we'd UPDATE to random bytes first.
        $this->pdo->prepare("DELETE FROM call_ratchet_state WHERE call_id = ?")->execute([$callIdBin]);

        return $this->generateSignedBundle($callId, $userId, $reason);
    }

    // HF-76.4: Signed Bundle
    private function generateSignedBundle($callId, $userId, $reason)
    {
        $timestamp = time();
        // Include Participants & Failures
        $stmt = $this->pdo->prepare("SELECT COUNT(*) FROM call_participants WHERE call_id = UNHEX(?)");
        $stmt->execute([$callId]);
        $pCount = $stmt->fetchColumn();

        $payload = "CALL_BUNDLE:$callId:$userId:$reason:$pCount:$timestamp";

        $privateKeyPath = __DIR__ . '/../../keys/server_private.pem';
        $signature = '';
        if (file_exists($privateKeyPath)) {
            $pkey = openssl_pkey_get_private(file_get_contents($privateKeyPath));
            openssl_sign($payload, $rawSig, $pkey, OPENSSL_ALGO_SHA256);
            $signature = base64_encode($rawSig);
        }
        return ['receipt' => $payload, 'signature' => $signature];
    }
}
