<?php
// includes/vault_kdf.php
// Epic 69: Vault Key Derivation

class VaultKDF
{
    const CONTEXT = "ChatFlect_Vault_Encryption_v1";

    public static function deriveKey($masterKey, $salt)
    {
        // HKDF-SHA256
        return hash_hkdf('sha256', $masterKey, 32, self::CONTEXT, $salt);
    }
}
