<?php
// config/deprecated_endpoints.php
// Epic 34: Deprecated Endpoints Registry

return [
    // Legacy v3 endpoints (deprecated)
    '/api/v3/send_message.php' => [
        'deprecated' => true,
        'sunset' => '2026-06-01',
        'replacement' => '/relay/send.php',
        'reason' => 'Migrating to relay architecture'
    ],
    '/api/v3/get_messages.php' => [
        'deprecated' => true,
        'sunset' => '2026-06-01',
        'replacement' => '/relay/pull.php',
        'reason' => 'Migrating to relay architecture'
    ],
    '/api/v3/mark_read.php' => [
        'deprecated' => true,
        'sunset' => '2026-06-01',
        'replacement' => '/relay/receipt.php',
        'reason' => 'Unified receipts endpoint'
    ],

    // Example future deprecation
    // '/relay/repair.php' => [
    //     'deprecated' => false,
    //     'sunset' => null,
    //     'replacement' => null
    // ],
];
