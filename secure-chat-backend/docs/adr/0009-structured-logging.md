# ADR-0009: Request ID + Structured Logging

## Status
**Accepted**

## Context
Debugging production issues requires tracing requests end-to-end.

## Decision
Client/server generate X-Request-ID; all logs include it in JSON format.

## Alternatives Considered
1. **Timestamp-only**: Not unique
2. **Session ID**: Too coarse
3. **Request ID (chosen)**: Precise tracing

## Consequences
- **Positive**: Full request tracing, grep-friendly
- **Negative**: Slightly larger log files

## Security Considerations
- No PII in logs
- Request ID is metadata only

## Performance Impact
- Negligible overhead
- JSON format enables log aggregation
