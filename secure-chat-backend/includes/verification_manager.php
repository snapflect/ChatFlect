<?php
// includes/verification_manager.php
// Epic 72: Trust Verification Logic

require_once __DIR__ . '/db_connect.php';

class VerificationManager
{
    private $pdo;

    public function __construct($pdo)
    {
        $this->pdo = $pdo;
    }

    // Generate Safety Number (Fingerprint)
    // Format: 60 digits (Split into blocks of 5)
    // Derived from HKDF(UserKey + ContactKey)
    public function getSafetyNumber($userKeyBin, $contactKeyBin)
    {
        // Sort keys to ensure direction-agnostic fingerprint (Alice-Bob same as Bob-Alice)
        // Actually, Signal uses (MyKey + TheirKey) so it IS directional in display usually?
        // Or stable? Signal: "Safety Numbers are calculated... sorted..."
        // Let's sort to make it unique per pair.

        $keys = [$userKeyBin, $contactKeyBin];
        sort($keys);
        $input = implode('', $keys);

        // Use SHA512 for high entropy, take first 30 bytes
        $hash = hash('sha512', $input, true);

        // Convert to numeric string (simplified for PHP)
        // Real implementation might use Base32 or specific numeric chunks.
        // We'll generate a 60-digit numeric string from the hash.
        // Quick & Dirty: CRC32 of chunks? No, not secure.
        // Convert bytes to big integer, then mod 10^60?
        // Let's use Hex -> Decimal for blocks.
        // Take first 8 bytes -> int, next 8 bytes -> int...
        // 60 digits = 12 blocks of 5 digits.

        // Security Note: Ideally use a standard library.
        // For ChatFlect, we'll use a visual hex fingerprint for now, or a simulated numeric one.
        // User Requirement: "60 digit numeric".

        $fingerprint = "";
        for ($i = 0; $i < 12; $i++) {
            $chunk = substr($hash, $i * 2, 2); // 2 bytes = max 65535
            $val = hexdec(bin2hex($chunk));
            $fingerprint .= sprintf("%05d", $val % 100000);
        }

        return $fingerprint;
    }

    public function verifyContact($userId, $contactId, $keyHash)
    {
        $pdo = $this->pdo;
        $pdo->beginTransaction();

        try {
            // 1. Update Status
            $stmt = $pdo->prepare("INSERT INTO contact_verifications (user_id, contact_user_id, verified_key_hash, status) 
                                         VALUES (?, ?, ?, 'VERIFIED')
                                         ON DUPLICATE KEY UPDATE verified_key_hash=VALUES(verified_key_hash), status='VERIFIED', verified_at=NOW()");
            $stmt->execute([$userId, $contactId, $keyHash]);

            // 2. HF-72.1: Generate & Store Signed Receipt
            $receiptData = json_encode([
                'verifier' => $userId,
                'target' => $contactId,
                'key_hash' => $keyHash,
                'timestamp' => time()
            ]);
            $sig = base64_encode(hash_hmac('sha256', $receiptData, 'ServerSecret')); // Mock signature

            $stmt = $pdo->prepare("INSERT INTO verification_receipts (user_id, contact_user_id, key_hash, signature) VALUES (?, ?, ?, ?)");
            $stmt->execute([$userId, $contactId, $keyHash, $sig]);

            $pdo->commit();
        } catch (Exception $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    public function unverifyContact($userId, $contactId)
    {
        $stmt = $this->pdo->prepare("UPDATE contact_verifications SET status='UNVERIFIED' WHERE user_id = ? AND contact_user_id = ?");
        $stmt->execute([$userId, $contactId]);
    }

    public function checkStatus($userId, $contactId, $currentKeyHash)
    {
        $stmt = $this->pdo->prepare("SELECT verified_key_hash, status FROM contact_verifications WHERE user_id = ? AND contact_user_id = ?");
        $stmt->execute([$userId, $contactId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row)
            return 'UNVERIFIED';

        if ($row['status'] === 'UNVERIFIED')
            return 'UNVERIFIED';

        if ($row['verified_key_hash'] !== $currentKeyHash) {
            // Key Changed!
            $this->markBroken($userId, $contactId);
            return 'BROKEN';
        }

        return 'VERIFIED';
    }

    public function getTrustStatus($userId, $contactId)
    {
        $stmt = $this->pdo->prepare("SELECT status FROM contact_verifications WHERE user_id = ? AND contact_user_id = ?");
        $stmt->execute([$userId, $contactId]);
        return $stmt->fetchColumn() ?: 'UNVERIFIED';
    }

    private function markBroken($userId, $contactId)
    {
        $stmt = $this->pdo->prepare("UPDATE contact_verifications SET status='BROKEN' WHERE user_id = ? AND contact_user_id = ?");
        $stmt->execute([$userId, $contactId]);
    }
}
