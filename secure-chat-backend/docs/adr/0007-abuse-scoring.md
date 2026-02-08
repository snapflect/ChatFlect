# ADR-0007: Abuse Scoring Framework

## Status
**Accepted**

## Context
Need proactive detection of bad actors before manual reports.

## Decision
Implement weighted abuse scoring with auto-escalation thresholds.

## Alternatives Considered
1. **Binary block**: Too harsh
2. **Manual review only**: Too slow
3. **Graduated scoring (chosen)**: Balanced

## Consequences
- **Positive**: Auto-detection, graduated response
- **Negative**: Tuning required

## Security Considerations
- Scores trigger cooldowns, not permanent bans
- Admin override available

## Performance Impact
- Score calculation: O(1)
- Background aggregation for heavy users
