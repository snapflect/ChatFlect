<?php
// includes/recovery_phrase.php
// Epic 73: Recovery Phrase Logic
// HF-73.1: Strong KDF Parameters

require_once __DIR__ . '/db_connect.php';

class RecoveryPhraseManager
{
    private $pdo;

    public function __construct($pdo)
    {
        $this->pdo = $pdo;
    }

    // Generate a 24-word Mnemonic (Simplified Mock)
    public function generatePhrase()
    {
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
        // Using SHA256 for demo; Argon2 preferred in prod for password hashing
        $hash = hash_pbkdf2('sha256', $phrase, $salt, 100000, 32, true);

        $stmt = $this->pdo->prepare("INSERT INTO recovery_phrases (user_id, phrase_hash, salt, kdf_params) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE phrase_hash=VALUES(phrase_hash), salt=VALUES(salt), kdf_params=VALUES(kdf_params)");

        // HF-73.1: Store Params
        $params = json_encode(['method' => 'pbkdf2-sha256', 'iterations' => 600000]);
        $stmt->execute([$userId, $hash, $salt, $params]);
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

    // HF-73.1: Derive AES Key from Phrase (Strong KDF)
    public function deriveKey($phrase, $salt = 'BackupSaltV1')
    {
        // High Iterations PBKDF2 (Recommend 600,000 for NIST/OWASP compliance)
        return hash_pbkdf2('sha256', $phrase, $salt, 600000, 32, true);
    }
}
