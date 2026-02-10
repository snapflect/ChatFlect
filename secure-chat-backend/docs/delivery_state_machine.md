# Delivery State Machine
**Epic 49: Deterministic Message Lifecycle**

## Device-Level States (`device_inbox`)
Each message for a specific device goes through this lifecycle:

1.  **PENDING**: Encrypted, stored, waiting for pull.
2.  **DELIVERED**: Device requested `pull` and received payload.
3.  **ACKED**: Device decrypted and processed payload.
4.  **READ**: User viewed message on this device.

## User-Level States (Aggregated)
- **SENT**: Queued for all devices (All PENDING).
- **DELIVERED**: At least one device has ACKED/DELIVERED.
- **READ**: At least one device sent READ receipt.

## Guarantees
1.  **Monotonicity**: State can only move forward (e.g., READ -> DELIVERED is forbidden).
2.  **Persistence**: READ state persists even if device is wiped (via Markers table).
3.  **Convergence**: If Device A reads, Device B sees "Read" status eventually.
