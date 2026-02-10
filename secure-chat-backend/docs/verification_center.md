# Verification Center & Trust UX

## Safety Numbers
ChatFlect uses a 60-digit numeric fingerprint derived from the sorted concatenation of both parties' Identity Keys. This ensures:
1.  **Consistency**: Alice and Bob see the same number.
2.  **Uniqueness**: Ties the session strictly to these two identity keys.

## Verification States
- **UNVERIFIED**: Default state. No manual verification performed.
- **VERIFIED**: User has manually confirmed the fingerprint. We store the `verified_key_hash`.
- **BROKEN (Key Changed)**: The contact's Identity Key changed (e.g., reinstall, or attack). The `verified_key_hash` no longer matches.

## Failure Mode
If status becomes `BROKEN`:
1.  Chat banner appears: "⚠️ Security Alert: Safety Number Changed"
2.  Sending is blocked until user acknowledges or re-verifies.
