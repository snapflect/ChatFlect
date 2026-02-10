<?php
// includes/scim_auth.php
// Epic 66: SCIM Authentication Middleware

require_once __DIR__ . '/db_connect.php';

class SCIMAuth
{
    private $pdo;

    public function __construct($pdo)
    {
        $this->pdo = $pdo;
    }

    public function authenticate()
    {
        $headers = getallheaders();
        $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';

        if (!preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
            $this->sendError(401, "Missing or invalid Authorization header");
        }

        $token = $matches[1];
        $hash = hash('sha256', $token);

        $stmt = $this->pdo->prepare("
            SELECT t.token_id, t.org_id, t.revoked, t.expires_at, t.allowed_ips 
            FROM scim_tokens t
            WHERE t.token_hash = ?
        ");
        $stmt->execute([$hash]);
        $scim = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$scim || $scim['revoked']) {
            $this->sendError(401, "Invalid or revoked SCIM token");
        }

        // Update Usage
        $this->pdo->prepare("UPDATE scim_tokens SET last_used_at = NOW() WHERE token_id = ?")->execute([$scim['token_id']]);

        return $scim; // {token_id, org_id}
    }

    private function sendError($code, $msg)
    {
        http_response_code($code);
        echo json_encode(['schemas' => ["urn:ietf:params:scim:api:messages:2.0:Error"], 'status' => (string) $code, 'detail' => $msg]);
        exit;
    }
}
