<?php
// includes/ttl_manager.php
// Epic 70: TTL Logic

require_once __DIR__ . '/db_connect.php';

class TTLManager
{
    private $pdo;

    public function __construct($pdo)
    {
        $this->pdo = $pdo;
    }

    public function getConversationTTL($convIdBin)
    {
        $stmt = $this->pdo->prepare("SELECT default_ttl_seconds, allow_shorter_overrides FROM conversation_ttl_rules WHERE conversation_id = ?");
        $stmt->execute([$convIdBin]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    public function setConversationTTL($convIdBin, $seconds, $allowOverride, $userId)
    {
        $sql = "INSERT INTO conversation_ttl_rules (conversation_id, default_ttl_seconds, allow_shorter_overrides, updated_by)
                VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE default_ttl_seconds=VALUES(default_ttl_seconds), 
                                        allow_shorter_overrides=VALUES(allow_shorter_overrides),
                                        updated_by=VALUES(updated_by)";
        $this->pdo->prepare($sql)->execute([$convIdBin, $seconds, $allowOverride, $userId]);
    }

    public function calculateExpiry($convIdBin, $messageTTL = null)
    {
        $policy = $this->getConversationTTL($convIdBin);

        $finalTTL = $policy['default_ttl_seconds'] ?? null;

        // Handle Per-Message Override
        if ($messageTTL !== null) {
            if ($finalTTL === null) {
                $finalTTL = $messageTTL; // No default, use message
            } else {
                // If policy exists, check if shorter is allowed
                if ($messageTTL < $finalTTL) {
                    if ($policy['allow_shorter_overrides']) {
                        $finalTTL = $messageTTL;
                    }
                } else {
                    // Message TTL > Default?
                    // Usually "Disappearing Messages" means max TTL is Policy.
                    // If Message wants to stay LONGER than policy?
                    // Security stance: Policy is Valid Maximum.
                    // But if policy is 7 days, and I want 1 hour? OK.
                    // If policy is 1 hour, and I want 7 days? NO.
                    // So we take MIN($default, $message).
                    $finalTTL = min($finalTTL, $messageTTL);
                }
            }
        }

        if ($finalTTL === null)
            return null; // Infinite

        return date('Y-m-d H:i:s', time() + $finalTTL);
    }

    public function scheduleDeletion($msgIdBin, $convIdBin, $expiresAt)
    {
        if (!$expiresAt)
            return;

        $stmt = $this->pdo->prepare("INSERT INTO message_expiry_queue (message_id, conversation_id, expires_at) VALUES (?, ?, ?)");
        $stmt->execute([$msgIdBin, $convIdBin, $expiresAt]);
    }
}
