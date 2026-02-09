<?php
// api/v4/public/trust/index.php
// Epic 59: Trust Center Discovery Endpoint
// Lists all verifiable resources for external auditors.

require_once __DIR__ . '/../../../../includes/env.php';

header('Content-Type: application/json');
header('Cache-Control: max-age=3600'); // Cache for 1 hour

$baseUrl = getenv('APP_URL') ?? 'https://chatflect.com';

echo json_encode([
    'platform' => 'ChatFlect',
    'trust_center_version' => '1.0',
    'endpoints' => [
        'public_key' => "$baseUrl/api/v4/public/trust/public_key.php",
        'transparency_reports' => "$baseUrl/api/v4/public/transparency/latest.php",
        'audit_chain_tip' => "$baseUrl/api/v4/public/trust/audit_chain_tip.php",
        'governance_policies' => "$baseUrl/api/v4/public/trust/governance_policy.php",
        'proof_aggregator' => "$baseUrl/api/v4/public/trust/proofs.php"
    ],
    'contact' => 'security@chatflect.com'
], JSON_PRETTY_PRINT);
