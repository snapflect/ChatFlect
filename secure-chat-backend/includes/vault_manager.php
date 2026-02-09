<?php
// includes/vault_manager.php
// Epic 69: Vault Logic

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/vault_kdf.php';

class VaultManager
{
    private $pdo;
    private $userId;
    private $masterKey; // Derived from user session/login. Ideally passed in context.

    public function __construct($pdo, $userId, $masterKey)
    {
        $this->pdo = $pdo;
        $this->userId = $userId;
        $this->masterKey = $masterKey;
    }

    // Get active key for writing
    private function getActiveKey()
    {
        $stmt = $this->pdo->prepare("SELECT * FROM vault_keys WHERE user_id = ? AND is_active = 1 ORDER BY version DESC LIMIT 1");
        $stmt->execute([$this->userId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            // Init first key
            $salt = random_bytes(32);
            $stmt = $this->pdo->prepare("INSERT INTO vault_keys (user_id, version, salt) VALUES (?, 1, ?)");
            $stmt->execute([$this->userId, $salt]);
            $keyId = $this->pdo->lastInsertId();
            $row = ['key_id' => $keyId, 'salt' => $salt, 'version' => 1];
        }

        return $row;
    }

    // Get specific key for reading
    private function getKeyById($keyId)
    {
        $stmt = $this->pdo->prepare("SELECT * FROM vault_keys WHERE key_id = ? AND user_id = ?");
        $stmt->execute([$keyId, $this->userId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row)
            throw new Exception("Vault key not found");
        return $row;
    }

    public function createItem($type, $metadata, $payload)
    {
        $keyRow = $this->getActiveKey();
        $encKey = VaultKDF::deriveKey($this->masterKey, $keyRow['salt']);

        $nonce = random_bytes(12);

        // Encrypt Metadata
        // We'll bundle metadata + payload or separate?
        // Let's encrypt payload. Metadata (title) is encrypted separately or part of payload?
        // Spec says: enc_metadata (BLOB) and enc_payload (LONGBLOB).
        // Since we have one row per item, we need separate nonces? Or derive from item nonce?
        // Simplest: Metadata is small. Nonce is for payload. Metadata uses specific nonce?
        // Let's use ONE nonce for both, but different AAD/Context? Or just encrypt a JSON blob?
        // Schema has `enc_metadata` and `enc_payload`.
        // We should protect integrity of both.
        // Let's encrypt Metadata with a derived subkey/nonce or just concat.
        // Or simpler: Metadata is unencrypted structure but sensitive fields are encrypted?
        // Spec: "No plaintext note titles".

        // Implementation:
        // Cipher = AES-256-GCM
        // We will concat metadata + payload for simplicity if payload is small data.
        // But File payloads are chunks.

        // Let's encrypt Metadata. 
        // We will reuse nonce but use different counter/context? Unsafe.
        // Let's generate a unique nonce for Metadata encryption.
        // Wait, schema has ONE nonce column.
        // Then we should persist item as ONE encrypted blob?
        // Ah, `enc_metadata` is separate.
        // Let's assume Metadata is small and we encrypt it with nonce.
        // Payload is encrypted with nonce + 1? Or separate IV.

        // To stick to schema:
        // Provide enc_metadata and enc_payload.
        // We really need separate IVs for security if using same key.
        // Code decision: Use `nonce` for payload.
        // Generate `meta_nonce` (derived or prepended) for metadata.

        $metaNonce = random_bytes(12);
        $metaCipher = openssl_encrypt(json_encode($metadata), 'aes-256-gcm', $encKey, OPENSSL_RAW_DATA, $metaNonce, $metaTag);
        $finalMeta = $metaNonce . $metaTag . $metaCipher; // Pack nonce+tag+cipher

        // Payload
        $payloadCipher = openssl_encrypt($payload, 'aes-256-gcm', $encKey, OPENSSL_RAW_DATA, $nonce, $payloadTag);

        $stmt = $this->pdo->prepare("INSERT INTO vault_items (user_id, key_id, item_type, enc_metadata, enc_payload, nonce, auth_tag) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            $this->userId,
            $keyRow['key_id'],
            $type,
            $finalMeta,
            $payloadCipher,
            $nonce,
            $payloadTag
        ]);

        return $this->pdo->lastInsertId();
    }

    public function getItem($itemId)
    {
        $stmt = $this->pdo->prepare("SELECT * FROM vault_items WHERE item_id = ? AND user_id = ?");
        $stmt->execute([$itemId, $this->userId]);
        $item = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$item)
            throw new Exception("Item not found");

        $keyRow = $this->getKeyById($item['key_id']);
        $encKey = VaultKDF::deriveKey($this->masterKey, $keyRow['salt']);

        // Decrypt Meta
        // Unpack nonce(12) + tag(16) + cipher
        $metaNonce = substr($item['enc_metadata'], 0, 12);
        $metaTag = substr($item['enc_metadata'], 12, 16);
        $metaCipher = substr($item['enc_metadata'], 28);
        $metaJson = openssl_decrypt($metaCipher, 'aes-256-gcm', $encKey, OPENSSL_RAW_DATA, $metaNonce, $metaTag);

        if ($metaJson === false)
            throw new Exception("Metadata Integrity Check Failed");

        // Decrypt Payload
        $payload = openssl_decrypt($item['enc_payload'], 'aes-256-gcm', $encKey, OPENSSL_RAW_DATA, $item['nonce'], $item['auth_tag']);
        if ($payload === false)
            throw new Exception("Payload Integrity Check Failed");

        return [
            'id' => $itemId,
            'metadata' => json_decode($metaJson, true),
            'payload' => $payload,
            'type' => $item['item_type'],
            'created_at' => $item['created_at']
        ];
    }

    public function deleteItem($itemId)
    {
        $stmt = $this->pdo->prepare("DELETE FROM vault_items WHERE item_id = ? AND user_id = ?");
        $stmt->execute([$itemId, $this->userId]);
    }

    public function listItems()
    {
        // Return only encrypted metadata blobs (or try to decrypt metadata on fly if feasible? Expensive list).
        // Usually, List API returns minimal info, maybe decrypt ONE metadata field (Title) if possible.
        // Or client downloads list and decrypts locally?
        // Since we have server-side masterKey derived from session, we CAN decrypt metadata here.
        // Let's return minimal decrypted metadata (e.g. title).

        $stmt = $this->pdo->prepare("SELECT item_id, key_id, enc_metadata, item_type, created_at FROM vault_items WHERE user_id = ?");
        $stmt->execute([$this->userId]);

        $items = [];
        // Cache keys to avoid DB hit loop
        $keys = [];

        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            if (!isset($keys[$row['key_id']])) {
                $keys[$row['key_id']] = VaultKDF::deriveKey($this->masterKey, $this->getKeyById($row['key_id'])['salt']);
            }
            $encKey = $keys[$row['key_id']];

            $metaNonce = substr($row['enc_metadata'], 0, 12);
            $metaTag = substr($row['enc_metadata'], 12, 16);
            $metaCipher = substr($row['enc_metadata'], 28);
            $metaJson = openssl_decrypt($metaCipher, 'aes-256-gcm', $encKey, OPENSSL_RAW_DATA, $metaNonce, $metaTag);

            $items[] = [
                'id' => $row['item_id'],
                'type' => $row['item_type'],
                'metadata' => $metaJson ? json_decode($metaJson, true) : null,
                'created_at' => $row['created_at']
            ];
        }
        return $items;
    }
}
