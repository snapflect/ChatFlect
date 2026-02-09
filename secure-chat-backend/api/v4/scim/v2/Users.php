<?php
// api/v4/scim/v2/Users.php
// Epic 66: SCIM Users Endpoint

require_once __DIR__ . '/../../../../includes/scim_auth.php';
require_once __DIR__ . '/../../../../includes/scim_manager.php';

// Auth
$auth = new SCIMAuth($pdo);
$context = $auth->authenticate(); // {token_id, org_id}

// HF-66.5: Rate Limiting
require_once __DIR__ . '/../../../../includes/abuse_guard.php';
$abuse = new AbuseGuard($pdo);
// Limit: 100 requests per minute per Token
if (!$abuse->checkLimit('scim_token:' . $context['token_id'], 100, 60)) {
    http_response_code(429);
    echo json_encode(['schemas' => ["urn:ietf:params:scim:api:messages:2.0:Error"], 'status' => "429", 'detail' => "Rate limit exceeded"]);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];
$pathInfo = $_SERVER['PATH_INFO'] ?? ''; // e.g., /123
$resourceId = ltrim($pathInfo, '/');

$mgr = new SCIMManager($pdo, $context['org_id'], $context['token_id']);
$input = json_decode(file_get_contents('php://input'), true);

header('Content-Type: application/scim+json');

try {
    if ($method === 'POST') {
        $res = $mgr->createUser($input);
        http_response_code(201);
        echo json_encode($res);
    } elseif ($method === 'GET') {
        // List or Get
        echo json_encode(['schemas' => ['urn:ietf:params:scim:api:messages:2.0:ListResponse'], 'Resources' => []]);
    } elseif ($method === 'PATCH' || $method === 'PUT') {
        if (!$resourceId)
            throw new Exception("ID required");
        $res = $mgr->updateUser($resourceId, $input);
        echo json_encode($res);
    } elseif ($method === 'DELETE') {
        if (!$resourceId)
            throw new Exception("ID required");
        $mgr->deleteUser($resourceId);
        http_response_code(204);
    }
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['schemas' => ["urn:ietf:params:scim:api:messages:2.0:Error"], 'detail' => $e->getMessage()]);
}
