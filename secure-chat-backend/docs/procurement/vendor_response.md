# Vendor Security Response (Standard)

## A. General Information
| Question | Answer |
| :--- | :--- |
| **Product Name** | ChatFlect Enterprise |
| **Hosting Provider** | Self-Hosted / Private Cloud |
| **Deployment Model** | Docker / Kubernetes |

## B. Data Security
| Question | Answer |
| :--- | :--- |
| **Do you encrypt data at rest?** | Yes, utilizing AES-256 (Database and Backups). |
| **Do you encrypt data in transit?** | Yes, TLS 1.2 or higher is mandatory. |
| **Who handles encryption keys?** | The Customer (On-Premises) or Key Management Service (Managed). |

## C. Access Control
| Question | Answer |
| :--- | :--- |
| **Does the app support SSO?** | Yes, OIDC (Azure AD, Okta) is supported. |
| **Does the app support MFA?** | Yes, mandated for Administrative actions. |
| **Are logs auditable?** | Yes, exhaustive Audit Logs are exportable to SIEM. |

## D. Compliance
| Question | Answer |
| :--- | :--- |
| **GDPR Compliant?** | Yes, DSAR and Deletion tools are built-in. |
| **Penetration Tested?** | Yes, internally audited (Phase 15). |
