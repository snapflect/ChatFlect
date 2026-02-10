# ADR-0002: Message Ordering via server_seq

## Status
**Accepted**

## Context
E2EE messages arrive encrypted; server cannot inspect content for ordering. Client timestamps unreliable across devices.

## Decision
Use server-assigned `server_seq` (auto-increment per chat) as the authoritative ordering mechanism.

## Alternatives Considered
1. **Client timestamps**: Unreliable, clock drift
2. **Lamport clocks**: Complex, multi-device issues
3. **Server seq (chosen)**: Simple, authoritative

## Consequences
- **Positive**: Deterministic ordering, gap detection
- **Negative**: Server becomes ordering authority

## Security Considerations
- No content leakage (seq is metadata only)
- Ordering visible to server (acceptable tradeoff)

## Performance Impact
- SELECT MAX + INSERT atomic per message
- Indexed retrieval: O(log n)
