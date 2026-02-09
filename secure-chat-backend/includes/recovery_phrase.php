<?php
// includes/recovery_phrase.php
// Epic 73: Recovery Phrase Logic

require_once __DIR__ . '/db_connect.php';

class RecoveryPhraseManager
{
    private $pdo;

    public function __construct($pdo)
    {
        $this->pdo = $pdo;
    }

    // Generate a 24-word Mnemonic (Simplified Mock)
    // In production, use a BIP39 library.
    public function generatePhrase()
    {
        // Mocking a dictionary for demo purposes
        $words = ['apple', 'brave', 'cloud', 'delta', 'eagle', 'forest', 'grain', 'house', 'igloo', 'jungle', 'kite', 'lemon', 'moon', 'noble', 'ocean', 'piano', 'queen', 'river', 'sun', 'tiger', 'unity', 'violin', 'whale', 'xenon'];

        $mnemonic = [];
        for ($i = 0; $i < 24; $i++) {
            $mnemonic[] = $words[random_int(0, count($words) - 1)];
        }
        return implode(' ', $mnemonic);
    }

    public function storePhraseHash($userId, $phrase)
    {
        $salt = random_bytes(32);
        // Using SHA256 for demo; Argon2 preferred in prod
        $hash = hash_pbkdf2('sha256', $phrase, $salt, 100000, 32, true);

        $stmt = $this->pdo->prepare("INSERT INTO recovery_phrases (user_id, phrase_hash, salt) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE phrase_hash=VALUES(phrase_hash), salt=VALUES(salt)");
        $stmt->execute([$userId, $hash, $salt]);
    }

    public function verifyPhrase($userId, $phrase)
    {
        $stmt = $this->pdo->prepare("SELECT phrase_hash, salt FROM recovery_phrases WHERE user_id = ?");
        $stmt->execute([$userId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row)
            return false;

        $hash = hash_pbkdf2('sha256', $phrase, $row['salt'], 100000, 32, true);
        return hash_equals($row['phrase_hash'], $hash);
    }

    // Derive AES Key from Phrase (PBKDF2)
    public function deriveKey($phrase)
    {
        // Use a fixed salt for key derivation (so it's consistent for encryption/decryption)
        // Note: Ideally, specific salt per user, but must be known during restore.
        // We can use the userId as salt or a static app salt?
        // Better: Use a salt stored with the backup metadata OR deterministically derived.
        // Let's use a static salt + user ID for now or just generic.
        // Prompt says "recovery-derived key".

        return hash_pbkdf2('sha256', $phrase, 'BackupSaltV1', 100000, 32, true);
    }
}
