# SEV2: Push Notification Failure

## Detection
- Push register failures spike
- FCM errors in logs
- Users report delayed messages

## Mitigation
```bash
export DISABLE_PUSH=true
# Clients fall back to polling
```

## Investigation
```bash
grep "FCM" logs/app.log | tail -50
grep "PUSH_FAIL" logs/app.log | tail -50
```

## Recovery
1. Check FCM credentials
2. Refresh service account
3. Re-enable: `unset DISABLE_PUSH`
4. Verify push delivery

## Postmortem Required
No (unless >4h duration)
