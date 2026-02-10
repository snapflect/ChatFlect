# ADR-0004: Gap Detection + Repair Protocol

## Status
**Accepted**

## Context
Network failures can cause missing messages. Users must be able to recover gaps.

## Decision
Implement client-side gap detection with server `repair.php` endpoint for range queries.

## Alternatives Considered
1. **Full resync**: Expensive, slow
2. **Push-based repair**: Server complexity
3. **Pull-based repair (chosen)**: Client-driven, simple

## Consequences
- **Positive**: Self-healing message stream
- **Negative**: Client must track expected seq

## Security Considerations
- Repair queries limited to chat participants
- Range limits prevent enumeration attacks

## Performance Impact
- Repair queries indexed by (chat_id, server_seq)
- Batch limits: 50 messages
