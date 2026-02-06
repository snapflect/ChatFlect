# Firestore Rule Validation Report (TASK 1.4-I) - ChatFlect

> **Version**: 1.0 | **Date**: 2026-02-07 | **Status**: P0 Complete

---

## Executive Summary

Firestore security rules analysis identifies **potential gaps** requiring runtime validation. Based on schema documentation and code analysis:

| Collection | Expected Access | Risk Level |
| :--- | :--- | :---: |
| `/chats/{chatId}/messages` | Participants only | HIGH |
| `/chats/{chatId}` | Participants only | MEDIUM |
| `/sync_requests/{sessionId}` | Owner only | CRITICAL |
| `/users/{uid}` | Owner only | MEDIUM |
| `/status/{userId}` | Owner write, public read | LOW |

---

## Collection Access Analysis

### 1. Messages Collection (`/chats/{chatId}/messages`)

| Attribute | Value |
| :--- | :--- |
| **Sensitivity** | CRITICAL (E2EE payloads) |
| **Expected Rule** | Only participants in chat can read/write |
| **Risk if Misconfigured** | Cross-user message access |
| **STRIDE Risk** | I1, I2 |

**Expected Rule Structure**:
```javascript
match /chats/{chatId}/messages/{msgId} {
  allow read, write: if request.auth != null 
    && request.auth.uid in get(/databases/$(database)/documents/chats/$(chatId)).data.participants;
}
```

**Validation Required**:
- [ ] Attempt read as non-participant
- [ ] Attempt write as non-participant
- [ ] Verify `keys` map not leaking device info

### 2. Chats Collection (`/chats/{chatId}`)

| Attribute | Value |
| :--- | :--- |
| **Sensitivity** | MEDIUM (metadata) |
| **Fields of Concern** | `lastMessage`, `unread_{UID}`, `typing.{UID}` |
| **Risk if Misconfigured** | Activity pattern leakage |
| **STRIDE Risk** | I1 |

**Metadata Leakage Test**:
```javascript
// Can non-participant read lastMessage?
const chatRef = doc(db, 'chats', 'somePrivateChatId');
const snap = await getDoc(chatRef);  // Should fail for non-participant
```

### 3. Sync Requests (`/sync_requests/{sessionId}`)

| Attribute | Value |
| :--- | :--- |
| **Sensitivity** | CRITICAL (encrypted private key) |
| **Expected Rule** | Only session owner and requester |
| **Risk if Misconfigured** | Private key interception |
| **STRIDE Risk** | H1 |

**Expected Rule Structure**:
```javascript
match /sync_requests/{sessionId} {
  allow write: if request.auth != null;  // Requester creates
  allow read: if request.auth != null && request.auth.uid == resource.data.targetUserId;
}
```

**Risk**: If rules allow any authenticated user to read, MITM on sync possible.

### 4. Users Collection (`/users/{uid}`)

| Attribute | Value |
| :--- | :--- |
| **Sensitivity** | MEDIUM (PII) |
| **Expected Rule** | Owner only |
| **Risk if Misconfigured** | User enumeration |

### 5. Status Collection (`/status/{userId}`)

| Attribute | Value |
| :--- | :--- |
| **Sensitivity** | LOW (presence) |
| **Expected Rule** | Owner write, authenticated read |
| **Current Behavior** | Likely open to all authenticated users |

---

## Validation Test Cases

### TC-I-01: Cross-User Message Read

| Field | Value |
| :--- | :--- |
| **Description** | Attempt to read messages from chat user is not in |
| **Preconditions** | User A authenticated, Chat belongs to User B & C |
| **Steps** | Query `/chats/B-C-chat/messages` as User A |
| **Expected** | Permission denied |
| **Status** | ⏳ Needs runtime test |

### TC-I-02: Sync Request Interception

| Field | Value |
| :--- | :--- |
| **Description** | Attempt to read sync request not intended for user |
| **Preconditions** | User A authenticated, sync request for User B |
| **Steps** | Read `/sync_requests/someSessionId` as User A |
| **Expected** | Permission denied |
| **Status** | ⏳ Needs runtime test |

### TC-I-03: Chat Metadata Access

| Field | Value |
| :--- | :--- |
| **Description** | Attempt to read chat metadata for non-participant |
| **Preconditions** | User A authenticated |
| **Steps** | Read `/chats/private-chat-id` as non-participant |
| **Expected** | Permission denied |
| **Status** | ⏳ Needs runtime test |

### TC-I-04: Message Write as Non-Participant

| Field | Value |
| :--- | :--- |
| **Description** | Attempt to write message to chat user is not in |
| **Preconditions** | User A authenticated, Chat belongs to User B & C |
| **Steps** | Write to `/chats/B-C-chat/messages` as User A |
| **Expected** | Permission denied |
| **Status** | ⏳ Needs runtime test |

---

## Known Issues from Documentation

From `firestore-schema-map.md`:

| Risk ID | Issue | Collection |
| :---: | :--- | :--- |
| I1 | Chat metadata leakage (unread, typing, lastMessage) | `/chats` |
| I2 | Fan-out key map reveals device count | `/chats/.../messages.keys` |
| H1 | Sync request contains encrypted private key | `/sync_requests` |

---

## Recommendations

### P0 - Critical

1. **Validate sync_requests rules** - Ensure only target user can read
2. **Audit messages access** - Verify participant-only enforcement

### P1 - High

1. **Encrypt metadata fields** - `lastMessage`, `typing` if possible
2. **Obfuscate keys map** - Pad to fixed size

### P2 - Medium

1. **Rate limit Firestore reads** - Prevent scraping
2. **Add audit logging for rule denials**

---

## Validation Status

| Acceptance Criteria | Status |
| :--- | :---: |
| Test messages collection cross-user read | ⏳ Needs runtime |
| Test chats collection cross-user access | ⏳ Needs runtime |
| Test sync_requests owner-only | ⏳ Needs runtime |
| Test statuses collection permissions | ⏳ Needs runtime |
| Confirm rules prevent cross-user reads | ⏳ Needs runtime |
| Document permission denied cases | ⏳ Pending |

> [!NOTE]
> Runtime validation with Firebase Emulator or production access required to complete this report.
