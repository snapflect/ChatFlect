# Disappearing Messages Security Model

## Overview
Enforceable Time-To-Live (TTL) ensures messages are cryptographically removed after expiry.

## Policy Hierarchy
1.  **Legal Hold**: Supercedes ALL TTL. If held, message is never deleted.
2.  **Conversation Default**: Admin sets default (e.g. 7 days).
3.  **Message Override**: Sender can request shorter/longer TTL, bounded by Conversation `allow_shorter_overrides`.
    - If Policy says "7 Days Max", message cannot set "30 Days".
    - `finalExpiry = MIN(PolicyTTL, MessageTTL)` (implied).

## Enforcement
- **Queue**: `message_expiry_queue` tracks `expires_at`.
- **Cron**: `enforce_ttl.php` permanently deletes from `messages` table.
- **Receipts**: System generates Signed Deletion Receipt as proof of destruction (for compliance).

## Privacy
- Deleted messages are wiped from DB.
- Metadata in Queue is also marked Processed/Deleted.
