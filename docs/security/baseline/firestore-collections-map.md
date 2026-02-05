# Firestore Collections Map (TASK 1.1-I) - ChatFlect

This document details the Firestore database structure used for real-time messaging, presence, and metadata.

## 1. Root Collections

### `chats`
Primary storage for chat session metadata and real-time state (typing/unread).
- **Structure**: `chats/{chatId}`
- **Fields**:
    - `isGroup`: (Boolean) True for group chats.
    - `name`: (String) Group name.
    - `participants`: (Array<String>) List of UIDs.
    - `lastMessage`: (String) Snippet for UI (e.g., "🔒 Message").
    - `lastTimestamp`: (Number) Unix timestamp.
    - `typing`: (Map) `{ UID: serverTimestamp() }`.
    - `unread_{UID}`: (Number) Counter for unread messages.
- **Subcollections**: `messages`, `locations`.

### `status`
Shared presence and activity tracking.
- **Structure**: `status/{UID}`
- **Fields**:
    - `state`: (String) "online" | "offline".
    - `last_changed`: (serverTimestamp) Last transition.
    - `platform`: (String) "mobile" | "web".
    - `heartbeat`: (serverTimestamp) For TTL reconciliation.

### `location_audit`
Security logging for location-sharing events.
- **Structure**: `location_audit/{autoID}`

---

## 2. Subcollections

### `chats/{chatId}/messages`
The E2EE message store.
- **Fields**:
    - `ciphertext`: (String) AES-GCM encrypted payload.
    - `iv`: (String) Base64 Initialization Vector.
    - `keys`: (Map) `{ UID: { DeviceUUID: EncKey } }`.
    - `senderId`: (String) Normalized UID.
    - `timestamp`: (Number) Unix timestamp.
    - `type`: (String) "text" | "image" | "video" | "contact" | etc.
    - `deletedFor`: (Array<String>) UIDs who have hidden the message.
    - `replyTo`: (Object) `{ id, senderId }`.

### `users/{UID}/contacts`
User-specific secondary contact list for fast lookup.
- **Structure**: `users/{UID}/contacts/{otherUID}`

### `users/{UID}/blocked`
Real-time enforcement of blocking.
- **Structure**: `users/{UID}/blocked/{blockedUID}`

### `users/{UID}/sync_requests`
Signaling for background tasks and data reconciliation.
- **Structure**: `users/{UID}/sync_requests/{reqID}`

---

## 3. Data Ownership & Trust

| Collection | Ownership | Trust Level |
| :--- | :--- | :--- |
| `chats` | Participants (Read/Write) | **Shared** |
| `messages` | Sender (Write), Participants (Read) | **E2EE Encrypted** |
| `status` | Owner (Write), Friends (Read) | **Public (App Scope)** |
| `location_audit` | Admin (Read), Users (Write) | **Security Log** |

---

## 4. Firestore Security Assumptions

- **Participants Only**: Access to `chats` and `messages` is restricted to users listed in the `participants` array (Enforced via Security Rules).
- **UID Identity**: All writes must match the `request.auth.uid`.
- **Atomic Operations**: Unread counters use Firestore `increment()` to avoid race conditions.
