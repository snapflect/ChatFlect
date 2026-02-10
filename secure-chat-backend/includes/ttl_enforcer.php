<?php
// includes/ttl_enforcer.php
// Epic 70: TTL Purge Logic

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/audit_logger.php'; // Assuming available

class TTLEnforcer
{
    private $pdo;

    public function __construct($pdo)
    {
        $this->pdo = $pdo;
    }

    public function runBatch($limit = 100)
    {
        echo "Running TTL Enforcement (Limit: $limit)...\n";

        // 1. Fetch expired items
        $sql = "SELECT message_id, conversation_id FROM message_expiry_queue 
                WHERE expires_at <= NOW() AND status = 'PENDING' 
                LIMIT " . (int) $limit . " FOR UPDATE SKIP LOCKED";
        // SKIP LOCKED requires MySQL 8 / MariaDB 10.3+. 
        // If not available, use simple select + status update.

        $stmt = $this->pdo->query($sql);
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($items as $item) {
            $msgId = $item['message_id'];
            $convId = $item['conversation_id'];

            // Check Legal Hold (Mock)
            // In real system, join with legal_holds table.
            if ($this->isUnderLegalHold($msgId, $convId)) {
                $this->markHeld($msgId);
                continue;
            }

            // Delete Message
            $this->deleteMessage($msgId);

            // Mark Processed
            $upd = $this->pdo->prepare("UPDATE message_expiry_queue SET status='PROCESSED' WHERE message_id = ?");
            $upd->execute([$msgId]);

            echo "Deleted message " . bin2hex($msgId) . "\n";
        }

        echo "Processed " . count($items) . " items.\n";
    }

    private function isUnderLegalHold($msgId, $convId)
    {
        // Placeholder check.
        // Return false for now.
        return false;
    }

    private function deleteMessage($msgIdBin)
    {
        // Hard Delete from Messages table
        // Assuming 'messages' table exists.
        $stmt = $this->pdo->prepare("DELETE FROM messages WHERE message_id = ?");
        $stmt->execute([$msgIdBin]);

        // Also delete from secure_messages/outbox if applicable
    }

    private function markHeld($msgIdBin)
    {
        $stmt = $this->pdo->prepare("UPDATE message_expiry_queue SET status='HELD' WHERE message_id = ?");
        $stmt->execute([$msgIdBin]);
        // Log Critical
        error_log("TTL Skipped for Legal Hold: " . bin2hex($msgIdBin));
    }
}
