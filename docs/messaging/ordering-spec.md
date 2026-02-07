# Message Ordering Specification

> **Version**: 1.0 | **Date**: 2026-02-08 | **Epic**: 13

---

## Overview

This specification defines the message ordering guarantees for ChatFlect. All devices see messages in the same deterministic order using a per-chat logical clock.

---

## Ordering Rules

### Primary: Server Sequence (`server_seq`)

| Property | Value |
|----------|-------|
| Type | 64-bit integer |
| Scope | Per chat |
| Authority | Server (final) |
| Monotonic | Strictly increasing |

```sql
ORDER BY server_seq ASC
```

### Secondary: Timestamp Fallback

Used only when `server_seq` is unavailable (legacy messages):

```sql
ORDER BY COALESCE(server_seq, 0), timestamp ASC
```

---

## Sequence Assignment

### Backend (Authority)

```php
// In send_message.php
$stmt = $conn->prepare("
    UPDATE chat_sequences 
    SET last_seq = last_seq + 1 
    WHERE chat_id = ?
");
$stmt->execute([$chatId]);

$result = $conn->query("SELECT last_seq FROM chat_sequences WHERE chat_id = ?");
$serverSeq = $result->fetch()['last_seq'];
```

### Client (Local Optimistic)

```typescript
// For optimistic UI display before server confirmation
const localSeq = getLastLocalSeq(chatId) + 1;
message.localSeq = localSeq;
message.serverSeq = null; // Assigned by server
```

---

## Multi-Device Reconciliation

### Scenario: Two devices send simultaneously

```
Device A: sends msg_1 (localSeq=5)
Device B: sends msg_2 (localSeq=5)
Server: assigns msg_1 -> serverSeq=5, msg_2 -> serverSeq=6

Result: Both devices see [msg_1, msg_2] (server order)
```

### Reconciliation Algorithm

1. On message fetch, sort by `server_seq ASC`
2. Update local cache with server order
3. If local message has different position, reorder UI

---

## Database Schema

### Chat Sequences Table

```sql
CREATE TABLE chat_sequences (
    chat_id VARCHAR(128) PRIMARY KEY,
    last_seq BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Messages Table Changes

```sql
ALTER TABLE messages ADD COLUMN server_seq BIGINT NULL;
ALTER TABLE messages ADD COLUMN server_received_at TIMESTAMP NULL;
ALTER TABLE messages ADD COLUMN local_seq BIGINT NULL;

-- Unique per chat
CREATE UNIQUE INDEX uk_chat_server_seq ON messages(chat_id, server_seq);
```

---

## Firestore Schema

```typescript
// chats/{chatId}
{
  lastSeq: number;        // Current sequence counter
  lastTimestamp: number;  // Deprecated, kept for compatibility
}

// chats/{chatId}/messages/{msgId}
{
  serverSeq: number;      // Server-assigned sequence
  localSeq: number;       // Client-assigned (optimistic)
  timestamp: number;      // Wall clock (fallback)
}
```

---

## Pagination

### Cursor-Based (Recommended)

```
GET /messages?chat_id=xxx&after_seq=100&limit=50
```

Returns messages where `server_seq > 100`, ordered by `server_seq ASC`.

### Offset-Based (Deprecated)

```
GET /messages?chat_id=xxx&offset=100&limit=50
```

Not stable under concurrent writes. Use cursor-based instead.

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| Network delay | Server order is final |
| Offline messages | Queued with `localSeq`, reordered on sync |
| Gap in sequence | Fetch missing messages |
| Duplicate seq | Rejected (unique constraint) |

---

## Test Cases

| TC | Description | Expected |
|----|-------------|----------|
| TC-ORD-01 | Two devices send simultaneously | Server assigns unique seq |
| TC-ORD-02 | Offline message sync | Correct order after sync |
| TC-ORD-03 | Pagination stability | Same results on repeated fetch |
| TC-ORD-04 | Legacy message ordering | Fallback to timestamp |
