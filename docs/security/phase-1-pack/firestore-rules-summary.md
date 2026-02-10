# Firestore Security Rules Summary

> **Version**: 1.0 | **Date**: 2026-02-08 | **Epic**: 7

---

## Overview

ChatFlect uses strict Firestore security rules to enforce access control and protect E2EE data. All rules enforce **device revocation checks** via custom claims.

---

## Rule Summary

| Collection | Read Access | Write Access | Notes |
|------------|-------------|--------------|-------|
| `/chats/{chatId}` | Participants + Active Device | ❌ Backend Only | Chat metadata |
| `/chats/.../messages` | Participants + Active Device | ❌ Backend Only | E2EE payloads |
| `/chats/.../locations` | Participants + Active Device | Owner Only | Live location |
| `/users/{uid}` | Owner + Active Device | Owner + Active Device | Profile data |
| `/users/.../contacts` | Owner + Active Device | Owner + Active Device | Contact list |
| `/users/.../blocked` | Owner + Active Device | Owner + Active Device | Blocked users |
| `/sync_requests/{id}` | Target User + Active Device | Create: Any, Delete: Owner | Key handover |
| `/status/{userId}` | Active Users | Owner + Active Device | Presence |
| `/device_registry/{uid}` | Owner | ❌ Backend Only | Device status |
| `/location_audit/{id}` | ❌ None | Active Users | Audit trail |

---

## Key Helper Functions

### isDeviceActive()
```javascript
function isDeviceActive() {
  let deviceUuid = request.auth.token.device_uuid;
  let uid = request.auth.uid;
  return deviceUuid != null
         && exists(/databases/$(database)/documents/device_registry/$(uid)/devices/$(deviceUuid))
         && get(/databases/$(database)/documents/device_registry/$(uid)/devices/$(deviceUuid)).data.status == 'active';
}
```

**Purpose**: Enforces device revocation by checking `device_uuid` custom claim against device registry.

### isParticipant(chatId)
```javascript
function isParticipant(chatId) {
  return isAuthenticated()
         && request.auth.uid in get(/databases/$(database)/documents/chats/$(chatId)).data.participants;
}
```

**Purpose**: Only chat participants can access messages.

---

## Security Controls

| Control | Implementation |
|---------|----------------|
| Device Revocation | `isDeviceActive()` on all rules |
| Participant Check | `isParticipant(chatId)` for chat data |
| Backend-Only Writes | `allow write: if false` for messages |
| Default Deny | Catch-all rule at end |

---

## Test Coverage

| Test Category | Tests | Status |
|---------------|-------|--------|
| TC-I-01: Cross-user message read | 2 | ✅ Pass |
| TC-I-02: Sync request interception | 2 | ✅ Pass |
| TC-I-03: Chat metadata access | 2 | ✅ Pass |
| TC-I-04: Non-participant write | 2 | ✅ Pass |
| TC-I-05: Metadata write block | 2 | ✅ Pass |
| TC-I-06: Device registry protection | 3 | ✅ Pass |
| TC-I-07: Unauthenticated access | 1 | ✅ Pass |
| TC-I-08: Revoked device blocked | 5 | ✅ Pass |

**Total: 19 tests passing**

---

## File Location

- **Rules**: `/firestore.rules`
- **Tests**: `/firestore-tests/firestore.rules.test.js`
- **Config**: `/firebase.json`
