# ADR-0008: SLA Gate CI Enforcement

## Status
**Accepted**

## Context
Prevent SLA regressions from reaching production.

## Decision
CI workflow checks health_report.php and blocks merge on DEGRADED/CRITICAL.

## Alternatives Considered
1. **Manual review**: Error-prone
2. **Post-deploy alerts**: Too late
3. **Pre-merge gate (chosen)**: Prevents issues

## Consequences
- **Positive**: Catches regressions before merge
- **Negative**: Requires staging environment

## Security Considerations
- Admin token via GitHub Secrets
- No credentials in code

## Performance Impact
- CI adds ~30s to PR checks
