<?php
// includes/fcm_helper.php

class FCMHelper
{

    // TODO: Load from service_account.json
    private static $serviceAccount = null;

    public static function sendWakeSignal($tokens, $chatId = null)
    {
        if (empty($tokens))
            return;

        // "Wake-Only" Strategy (Epic 20)
        // 1. Priority: HIGH (Critical for background wake)
        // 2. Content: Empty Notification block (No visual alert by default)
        // 3. Data: { type: 'SYNC' }
        // 4. Privacy: NO chat_id, NO sender info.

        $payload = [
            'data' => [
                'type' => 'SYNC',
                'timestamp' => (string) microtime(true)
            ],
            'android' => [
                'priority' => 'high'
            ],
            'apns' => [
                'payload' => [
                    'aps' => [
                        'content-available' => 1 // Silent Push for iOS
                    ]
                ]
            ]
        ];

        // MOCK SEND (until credentials provided)
        // In real impl, we use Google Client Logic

        // Log for Verification
        error_log("[FCM] Sending WAKE signal to " . count($tokens) . " devices.");
        error_log("[FCM] Payload: " . json_encode($payload));

        return true;
    }
}
