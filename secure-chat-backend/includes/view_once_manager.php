<?php
// includes/view_once_manager.php
// Epic 80: View Once Logic

require_once __DIR__ . '/db_connect.php';

class ViewOnceManager
{
    private $pdo;

    public function __construct($pdo)
    {
        $this->pdo = $pdo;
    }

    public function markViewed($messageId, $recipientId, $senderId)
    {
        // 1. Verify Message Exists & Belongs to Recipient
        // Also check if sender matches? Usually recipient triggers view.

        $stmt = $this->pdo->prepare("SELECT message_id, content, is_view_once FROM messages WHERE message_id = ? AND recipient_id = ?");
        $stmt->execute([$messageId, $recipientId]);
        $msg = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$msg)
            return false; // Not found or not yours
        if (!$msg['is_view_once'])
            return true; // Not view once, ignore burn

        // 2. BURN IT
        // Secure Overwrite (Shredding)
        // We overwrite 'content' with 0000.. then delete row? 
        // Or keep row metadata but clear content?
        // Requirement: "Permanently deletes... immediately".
        // Let's keep row for sync logs but NULL content.

        $zeroes = str_repeat("0", strlen($msg['content']));

        $this->pdo->beginTransaction();
        try {
            // Step A: Overwrite
            $upd = $this->pdo->prepare("UPDATE messages SET content = ? WHERE message_id = ?");
            $upd->execute([$zeroes, $messageId]);

            // Step B: Mark Viewed & NULL content (or Delete row)
            // Let's NULL it to indicate "burned".
            $burn = $this->pdo->prepare("UPDATE messages SET content = NULL, viewed_at = NOW() WHERE message_id = ?");
            $burn->execute([$messageId]);

            // If attachment, need to delete file from disk!
            // (Assuming content might be blob/path. If 'image' type...) 
            // For now, focusing on text/content column as per snippet.

            $this->pdo->commit();
            return true;
        } catch (Exception $e) {
            $this->pdo->rollBack();
            throw $e;
        }
    }
}
