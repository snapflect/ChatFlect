# Beta Bug Triage SOP
**Epic 101**

## Severity Matrix

| Severity | Definition | SLA (Fix Time) | Example |
| :--- | :--- | :--- | :--- |
| **P0 (Critical)** | Data Loss, Security Breach, App Crash on Launch. | **4 Hours** | "I lost my chat history", "Password leaked in logs". |
| **P1 (High)** | Core Feature Broken (No Workaround). | **24 Hours** | "Cannot send images", "Group Join fails". |
| **P2 (Medium)** | Core Feature Broken (Workaround exists), UI Glitch. | **3 Days** | "Dark mode looks weird", "Profile pic doesn't load immediately". |
| **P3 (Low)** | Typo, Minor Animation Jitter. | **Backlog** | "Button is 2px off-center". |

## Triage Process
1.  **Review**: Release Captain reviews #beta-feedback daily at 09:00 AM.
2.  **Tag**: Assign Severity (P0-P3).
3.  **Assign**: Tag the relevant Engineer (Backend vs Mobile).
4.  **Track**: Add to GitHub Issues / Jira.
