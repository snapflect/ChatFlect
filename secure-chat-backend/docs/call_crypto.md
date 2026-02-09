# Secure Call Protocol

## SRTP & Double Ratchet
- **Session Setup**: Clients negotiate generic `call_id`.
- **Key Derivation**: 
  - `HKDF(SessionKey, CallId, "MediaKey", Epoch)`
  - Clients derive keys independently.
- **Ratchet**:
  - Every 10s (or N packets), clients increment Epoch.
  - Generates new Media Key.
  - Deletes old Media Key (Forward Secrecy).

## Invariants
- **Replay Protection**: Packets track `Seq` and `Epoch`. Server/Client drops duplicates.
- **Join-Trust**: Only devices with valid `auth_token` and `device_uuid` in `call_participants` can signal.
