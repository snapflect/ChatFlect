<?php
// includes/call_ratchet_engine.php
// Epic 76: Call Key Ratchet Logic

require_once __DIR__ . '/db_connect.php';

class CallRatchetEngine
{
    private $pdo;

    public function __construct($pdo)
    {
        $this->pdo = $pdo;
    }

    public function rotateKey($callId, $userId, $deviceId)
    {
        $callIdBin = hex2bin($callId);

        // Fetch current ratchet state
        $stmt = $this->pdo->prepare("SELECT current_ratchet_counter FROM call_ratchet_state WHERE call_id = ? AND user_id = ? AND device_id = ?");
        $stmt->execute([$callIdBin, $userId, $deviceId]);
        $counter = $stmt->fetchColumn();

        if ($counter === false) {
            throw new Exception("Participant not in call");
        }

        $newCounter = $counter + 1;

        // Update DB
        $update = $this->pdo->prepare("UPDATE call_ratchet_state SET current_ratchet_counter = ?, last_key_rotation_at = NOW() WHERE call_id = ? AND user_id = ? AND device_id = ?");
        $update->execute([$newCounter, $callIdBin, $userId, $deviceId]);

        // Return new params for client to derive key
        // Note: Server does NOT derive the media key (E2EE).
        // Server tracks the RATchet state so it can inform OTHERS:
        // "User X is now on Epoch Y".
        // Clients use this to sync keystreams.

        return $newCounter;
    }

    public function getRatchetStates($callId)
    {
        $callIdBin = hex2bin($callId);
        $stmt = $this->pdo->prepare("SELECT user_id, device_id, current_ratchet_counter FROM call_ratchet_state WHERE call_id = ?");
        $stmt->execute([$callIdBin]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}
