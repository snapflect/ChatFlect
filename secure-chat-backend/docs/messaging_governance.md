# Messaging Governance

## Policy Controls
- **Block Media**: Orgs can disable image/video attachments.
- **Block Forwarding**: Prevents `forwardMessage` API usage.

## Freeze State
- **Critical Incidents**: Admins can `Freeze` a conversation.
- **Effect**: Read-Only mode for ALL participants.

## Legal Hold
- **Supremacy**: If `legal_hold_active` is TRUE, TTL and GDPR deletion logic MUST skip this conversation.
- **Audit**: All hold actions logged in `conversation_moderation_state`.
