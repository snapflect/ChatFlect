# Operations: Monitoring Verification SOP
**Epic 97**

## 1. Dashboard Validation (Grafana)
Access `https://grafana.internal.chatflect.com` and open **Backend Overview**.

### Checklist
- [ ] **Global Status**: Panel `System Status` must show `1`.
- [ ] **Throughput**: `Messages / Sec` should be > 0 (if traffic exists).
- [ ] **Saturation**: `Memory Usage` should be < 80% (Green).
- [ ] **Business**: `Total Users` matches DB count (`SELECT COUNT(*) FROM users`).

## 2. Alert Drills
Perform these drills once per Quarter.

### Drill A: Instance Down
1.  **Action**: Scale Deployment to 0.
    ```bash
    kubectl scale deployment chatflect-backend-staging --replicas=0 -n staging
    ```
2.  **Expected Result**:
    - Prometheus: `up` metric goes to 0.
    - AlertManager: `backend_down` fires (Severity: Critical).
    - Slack/PagerDuty: Notification received within 5 minutes.

### Drill B: Latency Spike
1.  **Action**: Run `k6` load test with high concurrency.
2.  **Expected Result**:
    - Grafana: P99 latency graph spikes red.
    - Alert: `high_latency` warning fires if > 500ms for 5m.
