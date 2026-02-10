# On-Call Runbook

## Quick Health Check
```bash
curl -H "X-Admin-Token:TOKEN" https://host/admin/v1/health_report.php
```

## MySQL Commands
```bash
# Connection test
mysql -e "SELECT 1"

# Active connections
mysqladmin processlist

# Check message gaps
SELECT chat_id, COUNT(*) as msgs, MAX(server_seq)-MIN(server_seq)+1 as expected
FROM messages GROUP BY chat_id HAVING msgs != expected;

# Active abuse locks
SELECT * FROM abuse_scores WHERE cooldown_until > NOW();
```

## Log Tracing
```bash
# Trace by request_id
grep "request_id\":\"XYZ" logs/app.log

# Recent failures
grep "SEND_FAIL" logs/app.log | tail -50

# Rate limit blocks
grep "RATE_LIMIT_HIT" logs/app.log | tail -50

# Security events
grep "SECURITY" logs/app.log | tail -50
```

## Metrics Queries
```bash
# Get latency stats
curl -H "X-Admin-Token:TOKEN" "https://host/admin/v1/metrics.php?minutes=60"

# Check counters
SELECT * FROM system_counters;
```

## Kill Switches
```bash
# Disable feature
export DISABLE_SEND=true

# Re-enable
unset DISABLE_SEND

# Check status via health_report
```

## Emergency Contacts
- Primary: On-call engineer
- Escalation: Tech lead
- Critical: CTO
