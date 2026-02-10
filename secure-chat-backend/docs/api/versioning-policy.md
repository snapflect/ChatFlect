# API Versioning Policy

## Version Format
All endpoints must be versioned:
```
/api/v3/...
/api/v4/...
/relay/v1/...
```

## Current Versions
| API | Version | Status |
| :--- | :--- | :--- |
| Relay | v1 | Active |
| Admin | v1 | Active |
| Legacy | v3 | Deprecated |

## Backward Compatibility Rules
1. v(N-1) remains active until v(N) adoption > 90%
2. Breaking changes only in new major versions
3. Minimum 90-day sunset period

## Deprecation Process
1. Add endpoint to `deprecated_endpoints.php`
2. Set sunset date (min 90 days)
3. Monitor adoption metrics
4. Remove after sunset

## Response Headers
All responses include:
- `X-API-Version: v1`
- `Deprecation: true` (if deprecated)
- `Sunset: <date>` (if deprecated)
- `Link: <replacement>` (if deprecated)

## Client Handling
Clients must:
1. Read `Deprecation` header
2. Log warning if deprecated
3. Show update banner if sunset < 30 days
