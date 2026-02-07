# Message Repair Protocol Specification

> **Version**: 1.0 | **Date**: 2026-02-08 | **Epic**: 14

---

## Overview

This protocol ensures no silent message loss. Gaps in message sequences are detected and automatically repaired.

---

## Gap Detection

### Trigger Conditions

| Condition | Action |
|-----------|--------|
| `received_seq > expected_seq` | Detect gap |
| `received_seq - expected_seq > 1` | Queue repair request |

### Algorithm

```typescript
function detectGaps(chatId: string, newSeq: number): number[] {
  const expectedSeq = getLastKnownSeq(chatId) + 1;
  
  if (newSeq <= expectedSeq) {
    return []; // No gap (or old message)
  }
  
  const gaps = [];
  for (let seq = expectedSeq; seq < newSeq; seq++) {
    gaps.push(seq);
  }
  
  return gaps;
}
```

---

## Repair Request API

### Endpoint

```
GET /v3/messages/repair?chatId={chatId}&fromSeq={from}&toSeq={to}
```

### Headers

```
Authorization: Bearer {firebase_token}
X-Device-UUID: {device_uuid}
```

### Response

```json
{
  "messages": [
    {
      "id": "msg_001",
      "server_seq": 52,
      "encrypted_payload": "base64...",
      "timestamp": 1707345600000
    }
  ],
  "total": 4,
  "from_seq": 52,
  "to_seq": 55
}
```

### Error Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Invalid range |
| 403 | Not authorized for this chat |
| 404 | No messages in range |

---

## Repair States

| State | Description |
|-------|-------------|
| `PENDING_REPAIR` | Gap detected, awaiting repair |
| `REPAIRING` | Repair request in progress |
| `REPAIRED` | Successfully recovered |
| `REPAIR_FAILED` | Recovery failed, manual action needed |

---

## Database Schema

### Local Gap Tracking

```sql
CREATE TABLE message_gaps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id TEXT NOT NULL,
    from_seq INTEGER NOT NULL,
    to_seq INTEGER NOT NULL,
    status TEXT DEFAULT 'PENDING_REPAIR',
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    repaired_at TIMESTAMP NULL
);
```

---

## Deduplication During Repair

1. Check if message already exists by `server_seq`
2. If exists, skip insertion
3. If new, insert and mark gap as repaired

```typescript
async function applyRepairedMessages(messages: Message[]): Promise<void> {
  for (const msg of messages) {
    const exists = await messageExists(msg.chatId, msg.serverSeq);
    if (!exists) {
      await insertMessage(msg);
    }
  }
}
```

---

## Retry Policy

| Attempt | Delay |
|---------|-------|
| 1 | Immediate |
| 2 | 5 seconds |
| 3 | 30 seconds |
| 4 | 5 minutes |
| 5+ | Manual trigger |

---

## Test Cases

| TC | Description | Expected |
|----|-------------|----------|
| TC-REP-01 | Gap detected | Repair request sent |
| TC-REP-02 | Repair returns messages | Gap filled |
| TC-REP-03 | Duplicate repair | No duplicates created |
| TC-REP-04 | Auth failure | 403 returned |
| TC-REP-05 | Empty range | 404 returned |
