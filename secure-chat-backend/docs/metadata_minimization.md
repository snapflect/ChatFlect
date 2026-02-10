# Metadata Minimization & Anonymity

## Security Model
We assume the server/database is honest-but-curious or potentially compromised.
Goal: Minimize information gain from a DB Dump or Log access.

## Anonymous Mode
- **Scope**: Per-Conversation.
- **Mechanism**: Server maintains `anonymous_profiles` map.
- **Privacy**: Other participants see `alias_name` and masked `user_id`. Real ID hidden from peer clients.

## Metadata Redaction
- **Logs**: All logs pass through `MetadataRedactor`.
- **Policy**:
    - IP Address -> `[REDACTED]`
    - Email -> `[REDACTED]`
    - Device ID -> `HASH(...)`

## Traffic Padding
- **Goal**: Frustrate Traffic Analysis (size correlation).
- **Algo**: Pad encrypted blobs to nearest bucket (512, 1024, 4KB, 16KB).
- **Overhead**: Constant factor, trades bandwidth for privacy.
