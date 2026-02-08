# SEV1: Message Loss

## Detection
- Repair endpoint spikes
- Client reports missing messages
- `PULL_EMPTY` despite `SEND_SUCCESS`
- server_seq gaps in database

## Mitigation
```bash
export DISABLE_SEND=true
# Freeze writes while investigating
```

## Investigation
```bash
# Check recent failures
grep "SEND_FAIL" logs/app.log | tail -100

# Check DB integrity
SELECT chat_id, MIN(server_seq), MAX(server_seq), COUNT(*) 
FROM messages GROUP BY chat_id HAVING MAX(server_seq) - MIN(server_seq) + 1 != COUNT(*);
```

## Recovery
1. Identify gap range
2. Run repair for affected chats
3. Re-enable sends: `unset DISABLE_SEND`
4. Monitor for 30 min

## Postmortem Required
Yes - document root cause and prevention.
