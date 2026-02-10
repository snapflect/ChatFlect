# Screenshot Protection & Privacy Shield

## Overview
ChatFlect provides strict controls to prevent screen capture in sensitive conversations.

## Screen Shield Mode
- **Android**: Uses `FLAG_SECURE`. Prevents screenshots and screen recording at OS level. App appears black in Recent Apps.
- **iOS**: Uses `UIScreen.isCaptured` to detect recording and blur the view. Screenshots may strictly be detected after-the-fact, but iOS 13+ APIs allow better prevention.
- **Web**: Best-effort. Shows watermarks.

## Event Logging
All screenshot attempts are logged to `privacy_events` table for audit.
- `SCREENSHOT_TAKEN`
- `SCREEN_RECORDING_STARTED`

## Org Policy
Organizations can enforce `shield_mode = ON` globally. Users in these orgs cannot disable the setting per conversation.
