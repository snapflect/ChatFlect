# Trust Score Model (Epic 55)

## Overview
A 0-1000 reputation score for Users, IPs, and Devices.

## Levels
| Score | Level | Privileges |
| :--- | :--- | :--- |
| **800-1000** | VERIFIED | High limits, instant feature access, no captchas. |
| **600-799** | HIGH | Standard limits, rare captchas. |
| **300-599** | MEDIUM | Default for new devices/users. |
| **0-299** | LOW | Strict limits, aggressive Captchas, easy blocking. |

## Scoring Factors
| Event | Delta | Description |
| :--- | :--- | :--- |
| `CLEAN_DAY` | +5 | Active for 24h with no violations. |
| `TRUSTED_DEVICE` | +20 | User adds a verified device. |
| `RATE_LIMIT` | -10 | Hit API rate limit. |
| `CAPTCHA_FAIL` | -20 | Failed challenge. |
| `TEMP_BAN` | -50 | Temporary abuse ban. |
| `REVOKE` | -100 | Device revoked by user. |
| `PERM_BAN` | -1000 | Nuclear option. |

## Default Scores
- New IP: 200 (Distrust by default)
- New Device: 300
- New User: 400
