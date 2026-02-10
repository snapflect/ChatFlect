<?php
// includes/fanout_encryptor.php
// Epic 48: Multi-Device Fanout Encryption Engine

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/session_manager.php';
require_once __DIR__ . '/device_manager.php';
require_once __DIR__ . '/crypto_utils.php'; // Assume basic AES helpers exist

class FanoutEncryptor
{
    private $pdo;
    private $sessionManager;

    public function __construct($pdo)
    {
        $this->pdo = $pdo;
        $this->sessionManager = new SessionManager($pdo);
    }

    public function fanoutMessage($senderUid, $senderDeviceId, $recipientUid, $messageUuid, $plaintextPayload)
    {
        // 1. Get all TRUSTED devices for recipient
        $devices = getTrustedDevices($this->pdo, $recipientUid);
        if (empty($devices)) {
            // Edge case: No devices. Store in "Wait for Device" queue or fail?
            // Signal stores for "primary" even if offline. 
            // For now, return empty (client handles "User has no devices")
            return ['count' => 0];
        }

        $fanoutCount = 0;
        $pdo = $this->pdo;

        foreach ($devices as $device) {
            $recipientDevId = $device['device_id'];

            // 2. Encrypt Per-Device (Simulated Signal Protocol)
            // Real world: Load Axolotl session, ratchet, encrypt.
            // Phase 8 Logic: Unique per-device encryption using Session Secret

            $sessionKey = $this->sessionManager->loadSession($senderDeviceId, $recipientDevId);

            // If no session exists, strictly we should fail or trigger PreKey fetch.
            // For this implementation, we simulate "Instant Session Init" if missing 
            // (In real Signal, this triggers X3DH).
            if (!$sessionKey) {
                // Warning: In prod this is a logic gap. We assume pre-established sessions or X3DH.
                // Log and skip for now to maintain Invariant 1 (No Plaintext)
                error_log("No session for $senderDeviceId -> $recipientDevId");
                continue;
            }

            // Encrypt (Pseudocode Wrapper)
            // encrypt($plaintext, $sessionKey) -> {ciphertext, nonce}
            // For MVP: We mock the encryption to ensure "Unique Ciphertext per Device" assumption holds
            $nonce = bin2hex(random_bytes(12));
            $ciphertext = base64_encode(openssl_encrypt($plaintextPayload, 'aes-256-gcm', $sessionKey, 0, hex2bin($nonce), $tag));
            $finalPayload = json_encode(['ct' => $ciphertext, 'tag' => base64_encode($tag)]);

            // 3. Store in Device Inbox ONLY if still TRUSTED (Race Condition Guard)
            $stmtCheck = $pdo->prepare("SELECT trust_state FROM devices WHERE device_id = ?");
            $stmtCheck->execute([$recipientDevId]);
            if ($stmtCheck->fetchColumn() !== 'TRUSTED') {
                continue; // Skip revoked/pending device
            }

            $stmt = $pdo->prepare("
                INSERT IGNORE INTO device_inbox (recipient_device_id, message_uuid, encrypted_payload, nonce, status, expires_at)
                VALUES (?, ?, ?, ?, 'PENDING', ?)
            ");
            // Default TTL: 30 days (2592000 seconds)
            $expiresAt = time() + 2592000;
            $stmt->execute([$recipientDevId, $messageUuid, $finalPayload, $nonce, $expiresAt]);
            $fanoutCount++;
        }

        return ['count' => $fanoutCount];
    }
}
