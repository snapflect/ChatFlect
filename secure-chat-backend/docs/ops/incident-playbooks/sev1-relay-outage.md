# SEV1: Relay Outage

## Detection
- `relay_send_p99 > 500ms`
- `error_rate_5xx > 5%`
- health_report status: CRITICAL

## Mitigation
```bash
export DISABLE_SEND=true
export DISABLE_PULL=true
```

## Investigation
```bash
# Check DB status
mysql -e "SELECT 1" 2>&1

# Check recent errors
grep "ERROR" logs/app.log | tail -50

# Check connections
mysqladmin processlist
```

## Recovery
1. Fix underlying issue (DB, network)
2. Run health check: `health_report.php`
3. Re-enable endpoints
4. Monitor latency for 30 min

## Postmortem Required
Yes
