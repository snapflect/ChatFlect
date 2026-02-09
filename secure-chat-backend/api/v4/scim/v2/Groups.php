<?php
// api/v4/scim/v2/Groups.php
// Epic 66: SCIM Groups Endpoint (Stub for Feature Completeness)

require_once __DIR__ . '/../../../../includes/scim_auth.php';

$auth = new SCIMAuth($pdo);
$auth->authenticate();

// SCIM Groups not fully implemented in DB layout yet for mapping, 
// but endpoint required for IdP connectivity checks.

header('Content-Type: application/scim+json');
echo json_encode([
    'schemas' => ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
    'totalResults' => 0,
    'Resources' => []
]);
