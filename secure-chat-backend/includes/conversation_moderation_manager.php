<?php
// includes/conversation_moderation_manager.php
// Epic 78: Conv Moderation Logic

require_once __DIR__ . '/db_connect.php';

class ConversationModerationManager
{
    private $pdo;

    public function __construct($pdo)
    {
        $this->pdo = $pdo;
    }

    public function freezeConversation($adminId, $conversationId, $reason)
    {
        // Check Admin

        $stmt = $this->pdo->prepare("
            INSERT INTO conversation_moderation_state (conversation_id, is_frozen, frozen_by_user_id, frozen_at, freeze_reason)
            VALUES (UNHEX(?), TRUE, ?, NOW(), ?)
            ON DUPLICATE KEY UPDATE is_frozen=TRUE, frozen_by_user_id=VALUES(frozen_by_user_id), frozen_at=NOW(), freeze_reason=VALUES(freeze_reason)
        ");
        $stmt->execute([$conversationId, $adminId, $reason]);
    }

    public function unfreezeConversation($adminId, $conversationId)
    {
        $stmt = $this->pdo->prepare("UPDATE conversation_moderation_state SET is_frozen=FALSE, frozen_by_user_id=NULL, frozen_at=NULL WHERE conversation_id = UNHEX(?)");
        $stmt->execute([$conversationId]);
    }

    public function setLegalHold($adminId, $conversationId, $ref, $active = true)
    {
        $stmt = $this->pdo->prepare("
            INSERT INTO conversation_moderation_state (conversation_id, legal_hold_active, legal_hold_ref)
            VALUES (UNHEX(?), ?, ?)
            ON DUPLICATE KEY UPDATE legal_hold_active=VALUES(legal_hold_active), legal_hold_ref=VALUES(legal_hold_ref)
        ");
        $stmt->execute([$conversationId, $active, $ref]);
    }

    public function removeMember($adminId, $conversationId, $targetUserId)
    {
        // Use ConversationManager logic to remove, but Authorized by Admin Role
        // Force Leave
        // $stmt = $this->pdo->prepare("DELETE FROM conversation_participants...");
        // Usually we mark as 'LEFT' or 'REMOVED'
    }
}
