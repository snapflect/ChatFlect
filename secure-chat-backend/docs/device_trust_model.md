# Multi-Device Trust Model
**Epic 47: Signal-Grade Device Identity**

## Core Concepts

1. **Device Identity**: Every device has its own `IdentityKeyPair`. The User is a conceptual aggregate of Trustable Devices.
2. **First-Device Trust**: The first device registered is automatically `TRUSTED`.
3. **Pending Join**: Subsequent devices start as `PENDING` and must be approved by an existing `TRUSTED` device.
4. **Revocation**: Any trusted device can revoke another. Revocation is permanent.

## Registry States
- **PENDING**: Registered, keys uploaded, but no access to messages.
- **TRUSTED**: Full E2EE participant. Receives message fanout.
- **REVOKED**: Cryptographically cut off. Keys deleted from fanout lists.

## Protocols

### 1. Device Join
1. Client generates `IdentityKey`, `PreKey`.
2. POST `/v4/devices/register` -> Server stores as PENDING.
3. Server notifies existing devices (`DEVICE_JOIN_REQUEST` event).
4. User taps "Approve" on existing device -> POST `/v4/devices/approve`.
5. Server promotes to TRUSTED.

### 2. Message Fanout (Sending)
When Alice sends to Bob:
1. Alice fetches Bob's *Trusted Device List*.
2. Alice encrypts payload *separately* for *each* device (pairwise sessions).
3. Payload = `[ (Dev1, Cipher1), (Dev2, Cipher2) ]`.

### 3. Revocation
1. User revokes "Old Phone" from "New Phone".
2. POST `/v4/devices/revoke`.
3. Server sets `trust_state = REVOKED`.
4. Server pushes `DEVICE_REVOKED` event.
5. Clients remove "Old Phone" from local session store immediately.
