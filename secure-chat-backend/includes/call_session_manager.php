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

        // Check if Call Active or Init
        $stmt = $this->pdo->prepare("SELECT status FROM calls WHERE call_id = ?");
        $stmt->execute([$callIdBin]);
        $status = $stmt->fetchColumn();

        if (!$status || $status === 'ENDED') {
            throw new Exception("Call not active");
        }

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

        return $this->generateCallReceipt($callId, $userId, $reason);
    }

    private function generateCallReceipt($callId, $userId, $reason)
    {
        $timestamp = time();
        $payload = "CALL_END:$callId:$userId:$reason:$timestamp";
        $signature = '';

        $privateKeyPath = __DIR__ . '/../../keys/server_private.pem';
        if (file_exists($privateKeyPath)) {
            $pkey = openssl_pkey_get_private(file_get_contents($privateKeyPath));
            openssl_sign($payload, $rawSig, $pkey, OPENSSL_ALGO_SHA256);
            $signature = base64_encode($rawSig);
        }
        return ['receipt' => $payload, 'signature' => $signature];
    }
}
