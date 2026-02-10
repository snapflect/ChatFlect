# Retention & Archives

## Retention
- **Supremacy**: Org Policy > Global Default. Legal Hold > Org Policy.
- **Enforcement**: Daily cron (`org_retention_enforcer`) purges data older than limit.
- **Safety**: Cannot purge data under Legal Hold.

## Archive Tier
- **Immutable**: Snapshots are generated monthly and stored encrypted.
- **Access**: Retrieving an archive requires Governance Approval.
