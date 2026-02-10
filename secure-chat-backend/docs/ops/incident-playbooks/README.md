# Incident Response Playbooks

## Severity Definitions

| Level | Impact | Response Time | Escalation |
| :--- | :--- | :--- | :--- |
| **SEV1** | Messages lost/duplicated, total outage | 15 min | On-call + Lead |
| **SEV2** | Degraded service, push failures | 1 hour | On-call |
| **SEV3** | Minor issues, rate limit tuning | 4 hours | Async |
| **SEV4** | Low priority, cosmetic | Next sprint | Ticket |

## Emergency Commands

```bash
# Kill switches
export DISABLE_SEND=true    # Stop all sends
export DISABLE_PULL=true    # Stop all pulls
export DISABLE_PUSH=true    # Stop push notifications

# Check health
curl -H "X-Admin-Token:TOKEN" /admin/v1/health_report.php

# Trace request
grep "request_id\":\"XYZ" logs/app.log
```

## Playbooks

- [SEV1: Message Loss](./sev1-message-loss.md)
- [SEV1: Message Duplication](./sev1-message-duplication.md)
- [SEV1: Relay Outage](./sev1-relay-outage.md)
- [SEV2: Push Failure](./sev2-push-failure.md)
- [SEV2: Presence Outage](./sev2-presence-outage.md)
- [SEV3: Rate Limit Overblocking](./sev3-rate-limit-overblocking.md)

## Rollback Policy

1. Deploy previous known-good version
2. Run migration rollback if applicable
3. Verify with health_report.php
4. Monitor 30 min before all-clear
