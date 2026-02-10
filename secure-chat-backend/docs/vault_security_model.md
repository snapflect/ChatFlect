# Vault Security Model

## Overview
Separate Zero-Knowledge storage for personal files and notes.

## Key Hierarchy
1.  **Master Key**: Derived from User Identity (Server-Side for MVP, Client-Side for future).
2.  **Vault Salt**: Unique salt per key version (stored in `vault_keys`).
3.  **Vault Key**: HKDF(Master, Salt).
4.  **Item Key**: Vault Key (AES-256-GCM). Each item has unique Nonce.

## Isolation
Vault keys are NOT chat session keys. A compromise of specific chat sessions (Ratchet state) does not yield the Vault Key.

## Integrity
AES-GCM Authenticated Encryption ensures no tampering. `auth_tag` is stored and verified on every read.

## Rotation
Users can rotate keys (`api/v4/vault/rotate_key.php`). New items use the new key. (Re-encryption of old items is a client-side or background task).
