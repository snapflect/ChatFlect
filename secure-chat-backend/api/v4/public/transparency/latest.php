<?php
// api/v4/public/transparency/latest.php
// HF-56.3: Public Safe Report Mode
// Returns the latest transparency report stats (sanitized) without admin info.

require_once __DIR__ . '/../../../../includes/db_connect.php';

header('Content-Type: application/json');

// 1. Fetch Latest
$stmt = $pdo->query("SELECT report_json, signature, generated_at FROM transparency_reports ORDER BY period_end DESC LIMIT 1");
$row = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$row) {
    http_response_code(404);
    echo json_encode(['error' => 'NO_REPORTS_PUBLISHED']);
    exit;
}

// 2. Parse & Sanitize
$rawJson = $row['report_json'];
$report = json_decode($rawJson, true);

// HF-56.7: CDN Caching
// Reports are immutable per generated ID.
// However, 'latest' changes when a new one is generated.
// We cache for 1 hour or until a new one is generated (implied by content change).
$etag = md5($row['signature']); // Signature is unique per report
header('Cache-Control: public, max-age=3600');
header('ETag: "' . $etag . '"');

if (isset($_SERVER['HTTP_IF_NONE_MATCH']) && trim($_SERVER['HTTP_IF_NONE_MATCH']) === '"' . $etag . '"') {
    http_response_code(304);
    exit;
}

// Sanitize (Example: Remove node_id if internal IP leaked, though current schema is safe)
// HF-56.3: Ensure nothing strictly internal is exposed.
// Current schema is mostly aggregated stats. We strip explicit 'node_id' for paranoia.
if (isset($report['header']['node_id'])) {
    unset($report['header']['node_id']);
}

echo json_encode([
    'meta' => [
        'published_at' => $row['generated_at'],
        'verification_endpoint' => '/api/v4/security/verify_transparency_report.php'
    ],
    'report' => $report,
    'signature' => $row['signature']
]);
