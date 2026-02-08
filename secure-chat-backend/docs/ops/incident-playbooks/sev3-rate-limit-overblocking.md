# SEV3: Rate Limit Overblocking

## Detection
- 429 spike in metrics
- User complaints about "too many requests"
- `rate_limit_blocks_total` high

## Mitigation
Temporarily increase limits:
```sql
-- No code change needed, tune in rate_limiter.php call:
-- checkRateLimit($conn, $userId, $deviceUuid, $ip, 'relay/send.php', 60, 60);
-- Change 30 -> 60 for limit
```

## Investigation
```bash
grep "RATE_LIMIT_HIT" logs/app.log | tail -100
```

## Recovery
1. Adjust rate limit parameters
2. Monitor 429 rate
3. Consider per-user tuning

## Postmortem Required
No
