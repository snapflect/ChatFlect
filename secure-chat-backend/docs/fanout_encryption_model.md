# Fanout Encryption Model
**Epic 48: Multi-Device Message Delivery**

## Core Concept
Messages are not stored as "One Ciphertext per User".
Messages are stored as "One Ciphertext per Device".
This ensures **Forward Secrecy** and **Session Isolation** per device.

## The Fanout Process
1. **Fetch**: Sender gets list of Recipient's TRUSTED devices.
2. **Session**: Sender loads/initializes unique crypto session for each device.
3. **Encrypt**: `Encrypt(Payload, SessionKey_i) -> Ciphertext_i`.
4. **Queue**: Server stores `Ciphertext_i` in `device_inbox` for `Device_i`.

## Database Structure
- `messages` (Table): High-level metadata (MessageID, Sender, Timestamp).
- `device_inbox` (Table): The actual encrypted payloads.
  - `recipient_device_id`
  - `encrypted_payload` (Unique per row)
  - `status` (PENDING -> DELIVERED)

## Security Invariants
1. **No Shared Ciphertext**: Each row in `device_inbox` MUST be unique ciphertext.
2. **Trust Enforcement**: Only devices with `trust_state = TRUSTED` are queued.
3. **Revocation**: If a device is revoked, it never receives new rows in `device_inbox`.
