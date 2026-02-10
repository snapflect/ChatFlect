# Incident Response Playbook (Epic 53)

## Phase 1: Identification
- **Alert**: Check SIEM / Dashboard (`api/v4/security/dashboard.php`).
- **Verify**: Use `report_actor.php` to check Trust Score of suspicious IP.

## Phase 2: Containment
- **Ban**: If Score > 100, issue Ban via `api/v4/security/ban.php`.
- **Snapshot**: Capture state via `incident_snapshot.php` for evidence.

## Phase 3: Investigation
- **Export**: Pull CSV via `export_audit.php` for deep dive.
- **Correlate**: Check `abuse_scores` to see timeline of escalation.

## Phase 4: Eradication & Recovery
- **Unban**: Only after root cause fixed.
- **Tune**: Update `rate_limit_policy.json` if attack was new pattern.
