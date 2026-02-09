<?php
// api/v4/public/security/hall_of_fame.php
// HF-57.5: Security Hall of Fame
// Publicly acknowledges researchers who have contributed valid reports.

require_once __DIR__ . '/../../../../includes/db_connect.php';

header('Content-Type: application/json');

// Cache public responses
header('Cache-Control: public, max-age=3600');

// List FIXED or DISCLOSED reports where we have a reporter name/email
// We sanitize email to just name part or mask it.
// Actually, bug bounty usually asks "Name to Credit".
// Our schema currently only has 'reporter_email'. 
// We will mask it: "j***@example.com" or just use the part before @ if safe?
// Better: only list ID and Severity and Date for now, unless we add 'reporter_name' column.
// Let's list by Report ID and Severity.

$stmt = $pdo->query("
    SELECT report_id, severity, created_at, 'Anonymous' as credit 
    FROM vulnerability_reports 
    WHERE status IN ('FIXED', 'DISCLOSED') 
    ORDER BY severity_rank(severity) DESC, created_at DESC
");
// Note: severity_rank is not a real function here, doing simple sort.
// Standard SQL sort: FIELD(severity, 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW')

$stmt = $pdo->query("
    SELECT report_id, severity, created_at, status 
    FROM vulnerability_reports 
    WHERE status IN ('FIXED', 'DISCLOSED') 
    ORDER BY CASE severity 
        WHEN 'CRITICAL' THEN 1 
        WHEN 'HIGH' THEN 2 
        WHEN 'MEDIUM' THEN 3 
        WHEN 'LOW' THEN 4 
    END ASC, created_at DESC
");

$reports = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo json_encode([
    'message' => 'ChatFlect Security Hall of Fame',
    'total_fixed' => count($reports),
    'reports' => $reports
]);
