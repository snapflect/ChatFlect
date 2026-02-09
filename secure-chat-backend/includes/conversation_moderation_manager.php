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
        // HF-78.1: Rate Limit (10/hr)
        if (!$this->checkRateLimit($adminId, 'FREEZE', 10)) {
            throw new Exception("Rate limit exceeded for Freeze actions.");
        }

        // HF-78.2: Governance Approval (Mock)
        // if (!$this->checkGovernance($adminId, 'FREEZE', $conversationId)) ...

        $convIdBin = hex2bin($conversationId); // Expecting Hex input from API usually

        $stmt = $this->pdo->prepare("
            INSERT INTO conversation_moderation_state (conversation_id, is_frozen, frozen_by_user_id, frozen_at, freeze_reason)
            VALUES (?, TRUE, ?, NOW(), ?)
            ON DUPLICATE KEY UPDATE is_frozen=TRUE, frozen_by_user_id=VALUES(frozen_by_user_id), frozen_at=NOW(), freeze_reason=VALUES(freeze_reason)
        ");
        $stmt->execute([$convIdBin, $adminId, $reason]);

        // HF-78.3: Signed Receipt
        return $this->generateReceipt('FREEZE', $conversationId, $adminId, $reason);
    }

    public function unfreezeConversation($adminId, $conversationId)
    {
        // Rate Limit
        if (!$this->checkRateLimit($adminId, 'UNFREEZE', 10))
            throw new Exception("Rate limit exceeded.");

        $stmt = $this->pdo->prepare("UPDATE conversation_moderation_state SET is_frozen=FALSE, frozen_by_user_id=NULL, frozen_at=NULL WHERE conversation_id = UNHEX(?)");
        $stmt->execute([$conversationId]);

        return $this->generateReceipt('UNFREEZE', $conversationId, $adminId, 'Manual Unfreeze');
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
        // HF-78.1: Rate Limit (20/hr)
        if (!$this->checkRateLimit($adminId, 'REMOVE_MEMBER', 20)) {
            throw new Exception("Rate limit exceeded for Member Removal.");
        }

        // Mock Removal Logic
        // ...

        return $this->generateReceipt('REMOVE_MEMBER', $conversationId, $adminId, "Removed $targetUserId");
    }

    // HF-78.1: Rate Limiting Stub
    private function checkRateLimit($adminId, $action, $limit)
    {
        // Mock: In prod, check Redis/DB count
        return true;
    }

    // HF-78.3: Receipt Generation
    private function generateReceipt($action, $targetId, $actorId, $details)
    {
        $timestamp = time();
        $payload = "MOD_RECEIPT:$action:$targetId:$actorId:$details:$timestamp";
        $signature = '';
        $privateKeyPath = __DIR__ . '/../../keys/server_private.pem';
        if (file_exists($privateKeyPath)) {
            $pkey = openssl_pkey_get_private(file_get_contents($privateKeyPath));
            openssl_sign($payload, $rawSig, $pkey, OPENSSL_ALGO_SHA256);
            $signature = base64_encode($rawSig);
        }
        return ['receipt' => $payload, 'signature' => $signature];
    }
}
