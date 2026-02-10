# ADR-0005: Receipts Stream Design

## Status
**Accepted**

## Context
Delivery/read receipts must be synchronized across devices without storing plaintext.

## Decision
Store receipts in separate `receipts` table, pull alongside messages in `pull.php`.

## Alternatives Considered
1. **Embed in message**: Mutates message record
2. **Separate endpoint**: Extra round-trip
3. **Co-located pull (chosen)**: Efficient, atomic

## Consequences
- **Positive**: Single pull for messages + receipts
- **Negative**: Slightly larger response payloads

## Security Considerations
- Receipt timestamps are metadata (acceptable)
- No content in receipts

## Performance Impact
- Indexed by (chat_id, id)
- ETag optimization for unchanged data
