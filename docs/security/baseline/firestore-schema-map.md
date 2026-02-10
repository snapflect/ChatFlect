# Firestore Data Model Mapping (TASK 1.1-I) - ChatFlect

This document provides a detailed technical specification of the Firestore schema used by ChatFlect for real-time signaling, messaging, and presence.

## 1. Core Messaging & Chat Data

| Collection Path | Document Fields | Who Writes | Who Reads | Security sensitivity | TTL | Est. Freq |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/chats/{chatId}` | `participants`, `isGroup`, `groupName`, `groupIcon`, `groupOwner`, `createdAt`, `lastMessage`, `lastTimestamp`, `lastSenderId`, `unread_{UID}`, `typing.{UID}` | Participants | Participants | **Medium** (Metadata) | None | Medium |
| `/chats/{id}/messages/{msgId}`| `type`, `ciphertext`, `iv`, `keys`, `senderId`, `timestamp`, `expiresAt`, `replyTo`, `metadata` | Sender | Participants | **CRITICAL** (E2EE) | `expiresAt` (Optional) | High |
| `/chats/{id}/locations/{uid}`| `lat`, `lng`, `timestamp`, `expiresAt`, `userId` | Property Owner | Participants | **High** (Live Geodata) | `expiresAt` (15m - 8h) | High (Burst) |

## 2. Presence & Activity

| Collection Path | Document Fields | Who Writes | Who Reads | Security sensitivity | TTL | Est. Freq |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/status/{userId}` | `state`, `last_changed`, `platform`, `heartbeat` | Property Owner | App Scope (Friends) | **Low** (Online Status) | Heartbeat (10m) | Medium |
| `/location_audit/{autoID}` | `viewerId`, `chatId`, `timestamp`, `type` | Viewer | Property Owner / Admin | **Medium** (Privacy Trace) | None | Low |

## 3. User Relationship & Metadata

| Collection Path | Document Fields | Who Writes | Who Reads | Security sensitivity | TTL | Est. Freq |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/users/{uid}/contacts/{oid}` | Full user object (from Backend) | Property Owner | Property Owner | **Medium** (Social Graph) | None | Low |
| `/users/{uid}/blocked/{oid}` | (Empty Doc, ID is blocked UID) | Property Owner | Property Owner | **Medium** | None | Low |

## 4. Signaling & Synchronization

| Collection Path | Document Fields | Who Writes | Who Reads | Security sensitivity | TTL | Est. Freq |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/users/{uid}/sync_requests/{id}` | `requesterUuid`, `status`, `processedAt`, `timestamp` | Other Own Devices | Property Owner | **Medium** (Signaling) | None | Low |
| `/sync_requests/{sessionId}` | `payload` (Encrypted Private Key), `timestamp` | Mobile App | Desktop Browser | **CRITICAL** (Key Handover) | Disposable | Very Low |

---

## 5. Security & Privacy Surface

### High-Sensitivity Data Flagged
- **`/chats/.../messages`**: Contains the E2EE payload and the `keys` map (RSA-OAEP wrapped session keys). While encrypted, the structure reveals the "Fan-out" graph. (**Risk I2**)
- **`/chats/.../locations`**: Real-time GPS coordinates. Must be strictly guarded by TTL and participant-only rules.
- **`/sync_requests/...`**: Transiently holds the Master Private Key encrypted for the Desktop's ephemeral key.
- **`/chats` (Metadata)**: Plaintext metadata like unread counts and typing status provide a leakage surface for activity analysis. (**Risk I1**)

### Estimated Traffic Patterns
- **High Frequency**: `messages` (per message sent) and `locations` (while live sharing).
- **Medium Frequency**: `status` (every app focus/blur + 10m heartbeat) and `chats` (on every message to update lastTimestamp/unread).
- **Low Frequency**: `contacts`, `blocked`, `location_audit`.

### TTL & Cleanup Strategy
- **Presence**: `PresenceService` heartbeats every 10 minutes. Backend/Client should cleanup `offline` states missing heartbeats > 30m.
- **Live Location**: Enforced by `expiresAt` timestamp. Client stops sharing automatically; reader filters expired docs.
- **Sync Requests**: HandshakeDocs are ephemeral and deleted by the `LinkService` immediately after completion.
