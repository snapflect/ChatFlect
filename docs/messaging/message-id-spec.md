# Message ID Specification

> **Version**: 1.0 | **Date**: 2026-02-08 | **Epic**: 12

---

## Overview

This specification defines the global message identity format for ChatFlect. Every message has a stable, immutable UUID generated client-side to enable idempotency and deduplication.

---

## UUID Format: UUIDv7

ChatFlect uses **UUIDv7** (RFC 9562) for message identifiers.

### Why UUIDv7?

| Property | Benefit |
|----------|---------|
| Time-ordered | Sortable by creation time |
| K-sortable | Efficient database indexing |
| Monotonic | No collisions within same client |
| 128-bit | Standard UUID compatibility |

### Format

```
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                         unix_ts_ms (48 bits)                  |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|  ver  |         rand_a (12 bits)          |var|   rand_b      |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                          rand_b (62 bits)                     |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
```

- **unix_ts_ms**: 48-bit Unix timestamp in milliseconds
- **ver**: 4-bit version (7)
- **rand_a**: 12-bit random
- **var**: 2-bit variant (10)
- **rand_b**: 62-bit random

### Example

```
01913b8f-5c04-7e7a-8312-5f4e9c3a1b2d
│         │    │
│         │    └── Version 7
│         └── Timestamp component
└── K-sortable prefix
```

---

## Generation Rules

### Rule 1: Client-Side Only

```typescript
// ✅ CORRECT: Generate on client
const messageId = generateUUIDv7();
const message = { id: messageId, content: "Hello" };
await sendMessage(message);

// ❌ WRONG: Never generate on server
// Server must reject messages without pre-generated UUID
```

### Rule 2: Immutable

Once generated, `message_uuid` **NEVER** changes:
- Same UUID persists through retries
- Same UUID used in local cache AND backend
- Same UUID in sender AND receiver storage

### Rule 3: One UUID Per Message Intent

```typescript
// ✅ Each tap = new message = new UUID
function onSendTap() {
  const uuid = generateUUIDv7();
  enqueueMessage(uuid, content);
}

// ✅ Retry = SAME UUID
function onRetry(failedMessage) {
  resendMessage(failedMessage.uuid, failedMessage.content);
}
```

---

## Implementation

### UUIDv7 Generator

```typescript
export function generateUUIDv7(): string {
  const timestamp = Date.now();
  const randomBytes = crypto.getRandomValues(new Uint8Array(10));

  // Timestamp (48 bits, big-endian)
  const timestampHex = timestamp.toString(16).padStart(12, '0');

  // Version 7 + random_a (4 + 12 bits)
  const randA = ((randomBytes[0] & 0x0f) << 8) | randomBytes[1];
  const versionRandA = (0x7000 | randA).toString(16);

  // Variant (10) + random_b (2 + 62 bits)
  const randB1 = ((0x80 | (randomBytes[2] & 0x3f)) << 8) | randomBytes[3];
  const randB2 = randomBytes.slice(4).reduce((acc, b, i) => 
    acc + b.toString(16).padStart(2, '0'), '');

  return `${timestampHex.slice(0, 8)}-${timestampHex.slice(8)}-${versionRandA}-${randB1.toString(16).padStart(4, '0')}-${randB2}`;
}
```

---

## Validation

### Backend Validation

```php
function isValidUUIDv7(string $uuid): bool {
    // Check format
    if (!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', $uuid)) {
        return false;
    }
    return true;
}
```

### Rejection Policy

| Scenario | Action |
|----------|--------|
| Missing UUID | HTTP 400 `MISSING_MESSAGE_UUID` |
| Invalid format | HTTP 400 `INVALID_UUID_FORMAT` |
| Not UUIDv7 | HTTP 400 `UUID_VERSION_MISMATCH` |
| Duplicate | HTTP 200 (return existing message) |

---

## Database Schema

```sql
CREATE TABLE messages (
    message_uuid CHAR(36) PRIMARY KEY,
    -- UUIDv7 is already sortable, no separate timestamp index needed
    ...
);

-- For idempotency tracking
CREATE TABLE message_idempotency (
    message_uuid CHAR(36) PRIMARY KEY,
    sender_uid VARCHAR(128) NOT NULL,
    receiver_uid VARCHAR(128) NOT NULL,
    chat_id VARCHAR(128) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_message_uuid (message_uuid)
);
```

---

## Collision Analysis

| Scenario | Probability |
|----------|-------------|
| Same ms, same client | ~10⁻²⁰ (random component) |
| Different ms | 0 (timestamp differs) |
| 1M messages/day | ~10⁻¹⁵ collision chance |

---

## Test Cases

| TC | Description | Expected |
|----|-------------|----------|
| TC-ID-01 | Generate 1000 UUIDs in 1ms | All unique |
| TC-ID-02 | Sort by UUID == sort by time | ✅ |
| TC-ID-03 | Backend rejects missing UUID | HTTP 400 |
| TC-ID-04 | Backend returns existing for duplicate | HTTP 200 + same data |
