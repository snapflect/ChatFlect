# Disaster Recovery Playbook

## Overview
This document describes how to recover ChatFlect from catastrophic data loss.

## Targets
- **RTO** (Recovery Time): < 4 hours
- **RPO** (Recovery Point): < 24 hours

## Backup Schedule
- Daily: 02:00 UTC
- Retention: 14 days daily, 2 months weekly, 1 year monthly

## Recovery Procedures

### 1. Full Database Restore
```bash
# List available backups
ls -la backups/

# Verify backup integrity
./scripts/verify_backup.sh 2026-02-08/chatflect_backup.sql.gz

# Restore
./scripts/restore_mysql.sh 2026-02-08/chatflect_backup.sql.gz
```

### 2. Partial Table Restore
```bash
# Extract specific tables
zcat backup.sql.gz | grep -A1000 "CREATE TABLE relay_messages" > messages.sql
mysql -u user -p chatflect_db < messages.sql
```

## Escalation Path
1. **SEV1**: Page on-call immediately
2. **SEV2**: Slack #incidents within 15 min
3. **SEV3**: Next business day

## Post-Incident
1. Root cause analysis
2. Update playbook if needed
3. Create ADR for major changes

## Verification
After restore, verify:
- [ ] Message count matches
- [ ] Receipts table populated
- [ ] Metrics endpoint returns data
