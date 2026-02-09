<?php
// includes/vuln_report_manager.php
// Epic 57: Vulnerability Report Logic
// Handles submission validation, sanitization, and persistence.

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/audit_logger.php';
require_once __DIR__ . '/abuse_guard.php';

class VulnReportManager
{
    private $pdo;
    private $logger;
    private $abuseGuard;

    public function __construct($pdo)
    {
        $this->pdo = $pdo;
        $this->logger = new AuditLogger($pdo);
        $this->abuseGuard = new AbuseGuard($pdo);
    }

    public function submitReport($ip, $data)
    {
        // 1. Abuse Check
        $this->abuseGuard->checkAccess($ip);

        // 2. Validate
        $title = trim($data['title'] ?? '');
        $severity = strtoupper($data['severity'] ?? 'LOW');
        $component = trim($data['affected_component'] ?? 'General');
        $email = trim($data['reporter_email'] ?? '');

        if (strlen($title) < 5 || strlen($title) > 255)
            throw new Exception("Invalid Title");
        if (!in_array($severity, ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']))
            throw new Exception("Invalid Severity");

        // 3. Payload Construction
        $payload = [
            'description' => substr($data['description'] ?? '', 0, 5000),
            'steps' => substr($data['steps_to_reproduce'] ?? '', 0, 5000),
            'poc' => substr($data['proof_of_concept'] ?? '', 0, 5000),
            'ip_source' => $ip
        ];

        // 4. Persistence
        $stmt = $this->pdo->prepare("INSERT INTO vulnerability_reports (title, reporter_email, severity, affected_component, payload_json) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([$title, $email, $severity, $component, json_encode($payload)]);

        $id = $this->pdo->lastInsertId();

        // 5. Audit
        $this->logger->log('VULN_REPORT_SUBMITTED', 'WARNING', ['report_id' => $id, 'severity' => $severity, 'ip' => $ip]);

        // 6. Anti-Spam: Increment Abuse Score slightly (precautionary)
        // If someone spams 100 reports, they get banned. Good researchers send 1-2.
        $this->abuseGuard->reportViolation('IP', $ip, 'VULN_SUBMISSION');

        return $id;
    }

    public function updateStatus($reportId, $status, $note = null, $adminUser = 'System')
    {
        $valid = ['NEW', 'TRIAGED', 'ACCEPTED', 'REJECTED', 'FIXED', 'DISCLOSED'];
        if (!in_array($status, $valid))
            throw new Exception("Invalid Status");

        $sql = "UPDATE vulnerability_reports SET status = ?, staff_notes = IF(? IS NOT NULL, ?, staff_notes) WHERE report_id = ?";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$status, $note, $note, $reportId]);

        $this->logger->log('VULN_STATUS_CHANGE', 'IMPORTANT', ['report_id' => $reportId, 'new_status' => $status, 'admin' => $adminUser]);
    }
}
