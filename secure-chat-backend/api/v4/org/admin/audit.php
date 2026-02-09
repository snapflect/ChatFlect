<?php
// api/v4/org/admin/audit.php
// Epic 61: Org-Specific Audit Feed
// Provide filtered view of global audit log for this org.
// Requires that we actually tag audit logs with org_id (future enhancement),
// but for now we can filter based on resources if applicable or just stub.

require_once __DIR__ . '/../../../../includes/auth_middleware.php';
require_once __DIR__ . '/../../../../includes/org_admin_manager.php';

$user = authenticate();
$orgIdHex = $_GET['org_id'] ?? '';

try {
    $orgIdBin = hex2bin($orgIdHex);
    $mgr = new OrgAdminManager($pdo);
    $mgr->ensureAdmin($orgIdBin, $user['user_id']);

    // HF-61.3: Pagination & Limits
    $limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 20;
    if ($limit > 100)
        $limit = 100;
    $offset = isset($_GET['offset']) ? (int) $_GET['offset'] : 0;

    // HF-61.2: Real Audit Feed
    // Assuming audit_logs has `org_id` column now (or metadata stores it).
    // For this patch, we'll query based on a hypothetical JSON match or `resource_id` being the org_id for ORG_* events.
    // Ideally: ALTER TABLE audit_logs ADD COLUMN org_id BINARY(16) NULL;

    // Simulating match via LIKE on event_type or resource_id (org_id is resource)
    $stmt = $pdo->prepare("
        SELECT log_id, event_type, user_id, resource_id, metadata, created_at, row_hash 
        FROM audit_logs 
        WHERE resource_id = ? OR metadata LIKE ?
        ORDER BY log_id DESC 
        LIMIT ? OFFSET ?
    ");
    $orgIdParam = $orgIdHex; // Resource ID is often Org ID for these events
    $metaParam = '%"org_id":"' . $orgIdHex . '"%';

    // Bind parameters carefully for LIMIT/OFFSET (PDO handling differs by driver, casting to int safe)
    $stmt->bindValue(1, $orgIdParam);
    $stmt->bindValue(2, $metaParam);
    $stmt->bindValue(3, $limit, PDO::PARAM_INT);
    $stmt->bindValue(4, $offset, PDO::PARAM_INT);

    $stmt->execute();
    $events = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(['audit_events' => $events, 'pagination' => ['limit' => $limit, 'offset' => $offset]]);

} catch (Exception $e) {
    http_response_code(403);
    echo json_encode(['error' => $e->getMessage()]);
}
