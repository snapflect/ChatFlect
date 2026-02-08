# ADR-0003: Idempotency via UUIDv7

## Status
**Accepted**

## Context
Mobile networks cause retries. Without idempotency, duplicate messages appear.

## Decision
Use client-generated UUIDv7 `client_uuid` as idempotency key with UNIQUE constraint.

## Alternatives Considered
1. **Request hash**: Content-dependent, breaks E2EE
2. **Session+counter**: Complex state management
3. **UUIDv7 (chosen)**: Time-sortable, unique, simple

## Consequences
- **Positive**: Duplicate rejection at DB level
- **Negative**: 409 response on duplicates (acceptable)

## Security Considerations
- UUID reveals approximate send time (acceptable metadata)
- No content leakage

## Performance Impact
- UNIQUE index lookup: O(log n)
- Minimal overhead
