# ADR-0006: DB-Backed Rate Limiting

## Status
**Accepted**

## Context
API abuse protection needed. Memory-based limits don't persist across restarts.

## Decision
Use MySQL `rate_limits` table with sliding window counter.

## Alternatives Considered
1. **Redis**: Fast but separate dependency
2. **Memory**: Resets on restart
3. **MySQL (chosen)**: Persistent, auditable

## Consequences
- **Positive**: Durable limits, audit trail
- **Negative**: DB write per request

## Security Considerations
- Rate limits keyed by IP + user + device
- Prevents enumeration and spam

## Performance Impact
- INSERT ON DUPLICATE optimized
- Periodic cleanup cron
