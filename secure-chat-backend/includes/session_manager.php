<?php
// includes/session_manager.php
// Epic 48: Device Session Management

require_once __DIR__ . '/db_connect.php';

class SessionManager
{
    private $pdo;

    public function __construct($pdo)
    {
        $this->pdo = $pdo;
    }

    public function getSessionId($senderDev, $recipientDev)
    {
        // Deterministic session ID for the pair
        // Sort to ensure directionality (Sender -> Recipient matters in Signal, usually directional)
        // Actually Signal sessions are directional. 
        return hash('sha256', "{$senderDev}:{$recipientDev}");
    }

    public function loadSession($senderDev, $recipientDev)
    {
        $sid = $this->getSessionId($senderDev, $recipientDev);
        $stmt = $this->pdo->prepare("SELECT chain_state_json FROM device_sessions WHERE session_id = ?");
        $stmt->execute([$sid]);
        return $stmt->fetchColumn();
    }

    public function saveSession($senderUid, $senderDev, $recipientUid, $recipientDev, $stateJson)
    {
        $sid = $this->getSessionId($senderDev, $recipientDev);
        $stmt = $this->pdo->prepare("
            INSERT INTO device_sessions 
            (session_id, sender_user_id, sender_device_id, recipient_user_id, recipient_device_id, chain_state_json)
            VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                chain_state_json = VALUES(chain_state_json),
                last_active_at = NOW()
        ");
        $stmt->execute([$sid, $senderUid, $senderDev, $recipientUid, $recipientDev, $stateJson]);
    }
}
