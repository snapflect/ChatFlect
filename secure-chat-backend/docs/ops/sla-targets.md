# SLA Targets

## Latency Targets

| Metric | Target | DEGRADED | CRITICAL |
| :--- | :--- | :--- | :--- |
| Relay Send P95 | < 200ms | > 200ms | > 400ms |
| Relay Send P99 | < 350ms | > 350ms | > 700ms |
| Relay Pull P95 | < 250ms | > 250ms | > 500ms |
| Relay Pull P99 | < 400ms | > 400ms | > 800ms |

## Error Rate Targets

| Metric | Target | DEGRADED | CRITICAL |
| :--- | :--- | :--- | :--- |
| 5xx Error Rate | < 1% | > 1% | > 5% |
| Rate Limit Blocks | < 5% | > 5% | > 15% |
| Push Failure Rate | < 2% | > 2% | > 10% |

## Availability Targets

- **Target Uptime**: 99.9% (monthly)
- **Max Planned Downtime**: 4 hours/month
- **Incident Response Time**:
  - SEV1: 15 minutes
  - SEV2: 1 hour
  - SEV3: 4 hours

## Monitoring

- Health check: `/admin/v1/health_report.php`
- Alerts: `/admin/v1/alerts.php`
- Metrics: `/admin/v1/metrics.php`
