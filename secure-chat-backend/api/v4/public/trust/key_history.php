<?php
// api/v4/public/trust/key_history.php
// Epic 59 HF: Key Rotation History
// Lists active and past keys so verifiers can differentiate "invalid sig" from "old key".

require_once __DIR__ . '/../../../../includes/db_connect.php';

header('Content-Type: application/json');
header('Cache-Control: public, max-age=86400'); // Cache for 1 day

// In a real system, we'd have a key_rotation_log table.
// For now, we'll mock it based on the static key file + DB metadata if we had it.
// Let's assume there's only one key for now, but the structure allows expansion.

$currentKey = file_exists(__DIR__ . '/../../../../keys/server_public.pem')
    ? file_get_contents(__DIR__ . '/../../../../keys/server_public.pem')
    : 'DEV_KEY_PLACEHOLDER';

$history = [
    [
        'status' => 'ACTIVE',
        'valid_from' => '2026-01-01T00:00:00Z',
        'valid_until' => null,
        'fingerprint' => hash('sha256', $currentKey),
        'public_key_pem' => $currentKey
    ]
];

echo json_encode(['key_history' => $history], JSON_PRETTY_PRINT);
