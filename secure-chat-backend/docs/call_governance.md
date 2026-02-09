# Call Governance Model

## Policy Supremacy
- **Org Policy** > **User Preference**.
- If Org disables calls, `canStartCall` throws Exception.

## Moderation
- **Force End**: Admin can terminate any ACTIVE call in their org.
- **Kick**: Admin can revoke specific device access.
- **Audit**: All mod actions signed and stored in `call_moderation_events`.

## Abuse Monitoring
- Repeated join failures (>50/hr) trigger Trust Score penalty.
