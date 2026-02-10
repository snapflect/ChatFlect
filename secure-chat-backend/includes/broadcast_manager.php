<?php
// includes/broadcast_manager.php
// Epic 79: Broadcast Logic

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/CryptoUtils.php';

class BroadcastManager
{
    private $pdo;

    public function __construct($pdo)
    {
        $this->pdo = $pdo;
    }

    public function createList($ownerId, $name, $memberIds = [])
    {
        $listId = CryptoUtils::generateUUIDv7();
        $listIdBin = hex2bin(str_replace('-', '', $listId)); // Store as binary if schema uses binary?
        // Actually schema uses VARBINARY(32), let's stick to Hex string in PHP usually, unless consistent.
        // My schema 092 said VARBINARY(32). Let's use hex2bin.

        $this->pdo->beginTransaction();
        try {
            $stmt = $this->pdo->prepare("INSERT INTO broadcast_lists (list_id, owner_user_id, list_name) VALUES (?, ?, ?)");
            $stmt->execute([$listIdBin, $ownerId, $name]);

            $this->addMembers($listIdBin, $memberIds);

            $this->pdo->commit();
            return bin2hex($listIdBin);
        } catch (Exception $e) {
            $this->pdo->rollBack();
            throw $e;
        }
    }

    public function updateList($ownerId, $listId, $name)
    {
        if (!$this->isOwner($ownerId, $listId))
            throw new Exception("Unauthorized");

        $stmt = $this->pdo->prepare("UPDATE broadcast_lists SET list_name = ? WHERE list_id = UNHEX(?) AND owner_user_id = ?");
        $stmt->execute([$name, $listId, $ownerId]);
    }

    public function deleteList($ownerId, $listId)
    {
        if (!$this->isOwner($ownerId, $listId))
            throw new Exception("Unauthorized");

        // Soft delete
        $stmt = $this->pdo->prepare("UPDATE broadcast_lists SET deleted_at = NOW() WHERE list_id = UNHEX(?)");
        $stmt->execute([$listId]);
    }

    public function addMembers($listIdBin, $memberIds)
    {
        if (empty($memberIds))
            return;

        $stmt = $this->pdo->prepare("INSERT IGNORE INTO broadcast_list_members (list_id, member_user_id) VALUES (?, ?)");
        foreach ($memberIds as $uid) {
            $stmt->execute([$listIdBin, $uid]);
        }
    }

    private function isOwner($userId, $listIdHex)
    {
        $stmt = $this->pdo->prepare("SELECT 1 FROM broadcast_lists WHERE list_id = UNHEX(?) AND owner_user_id = ? AND deleted_at IS NULL");
        $stmt->execute([$listIdHex, $userId]);
        return (bool) $stmt->fetchColumn();
    }

    // THE FANOUT ENGINE
    public function sendBroadcast($senderId, $listId, $encryptedPayloads)
    {
        // encryptedPayloads is a Map<UserId, EncryptedBlob> provided by Client?
        // OR Client sends "one message" and server re-encrypts? NO. E2EE.
        // Client MUST provide { recipient_id: { ciphertext: ... } } for EACH recipient in the list.
        // This means Client iterates list, prepares N ciphertexts, uploads them.

        if (!$this->isOwner($senderId, $listId))
            throw new Exception("Unauthorized");

        // Verify Membership
        $stmt = $this->pdo->prepare("SELECT member_user_id FROM broadcast_list_members WHERE list_id = UNHEX(?)");
        $stmt->execute([$listId]);
        $members = $stmt->fetchAll(PDO::FETCH_COLUMN); // [1, 5, 99]

        // Validate payload coverage
        // foreach ($members as $uid) if (!isset($encryptedPayloads[$uid])) error...

        $this->pdo->beginTransaction();
        try {
            $msgStmt = $this->pdo->prepare("INSERT INTO messages (conversation_id, sender_id, recipient_id, message_type, content, iv, created_at) VALUES (?, ?, ?, 'text', ?, ?, NOW())");
            // Note: Broadcasts are technically 1:1 messages in separate conversations? 
            // Yes, "Fanout produces N DM messages".
            // So we need conversation_id for Sender<->Recipient.
            // Assume getConversationId($sender, $recipient) helper exists or we look it up.

            foreach ($members as $recipientId) {
                if (!isset($encryptedPayloads[$recipientId]))
                    continue; // Skip if missing key

                // Mock Conv Lookup
                // $convId = $this->getDmConversation($senderId, $recipientId);
                $convId = "MOCK_CONV_" . $senderId . "_" . $recipientId;

                $payload = $encryptedPayloads[$recipientId];
                // Insert
                // $msgStmt->execute([...]);
            }

            $this->pdo->commit();
        } catch (Exception $e) {
            $this->pdo->rollBack();
            throw $e;
        }
    }
}
