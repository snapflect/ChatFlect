# ADR-0001: Relay Backend Migration

## Status
**Accepted**

## Context
ChatFlect's original architecture used Firestore as the sole message transport. This created:
- No server-side ordering guarantees
- No audit trail
- Limited offline recovery
- No abuse detection capability

## Decision
Migrate message transport from Firestore to a PHP+MySQL relay backend while maintaining Firestore for presence and user data.

## Alternatives Considered
1. **Pure Firestore**: Simpler but no ordering guarantees
2. **Full MySQL**: Loses real-time presence benefits
3. **Hybrid (chosen)**: Best of both worlds

## Consequences
- **Positive**: Server-side ordering, audit trail, abuse detection
- **Negative**: Increased complexity, two data stores

## Security Considerations
- MySQL stores encrypted message payloads (E2EE preserved)
- Server cannot read plaintext
- Auth via Firebase tokens

## Performance Impact
- Latency: +50ms for relay round-trip
- Throughput: MySQL handles 10K+ msg/sec
