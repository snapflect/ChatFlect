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

    public function assignDisclosureId($reportId)
    {
        $year = date('Y');
        // Find next ID
        $stmt = $this->pdo->prepare("SELECT COUNT(*) FROM vulnerability_reports WHERE disclosure_id LIKE ?");
        $stmt->execute(["CHATFLECT-$year-%"]);
        $count = $stmt->fetchColumn() + 1;
        $id = sprintf("CHATFLECT-%s-%03d", $year, $count); // CHATFLECT-2026-001

        $stmtUpd = $this->pdo->prepare("UPDATE vulnerability_reports SET disclosure_id = ? WHERE report_id = ?");
        $stmtUpd->execute([$id, $reportId]);

        return $id;
    }

    public function scanFile($path)
    {
        // HF-57.9: Virus Scan Hook
        // In prod: exec('clamdscan ' . escapeshellarg($path), $output, $return);
        // For now, assume safe.
        // Return true if safe, false if infected.
        return true;
    }

    public function checkUploadQuota($ip, $size)
    {
        // HF-57.10: Upload Quotas
        // Global Limit: 1GB/day
        // IP Limit: 50MB/day

        $today = date('Y-m-d 00:00:00');

        // 1. Check IP
        $stmt = $this->pdo->prepare("
            SELECT SUM(file_size) 
            FROM vulnerability_attachments va
            JOIN vulnerability_reports vr ON va.report_id = vr.report_id
            WHERE vr.payload_json->>'$.ip_source' = ? 
            AND va.uploaded_at >= ?
        ");
        $stmt->execute([$ip, $today]);
        $ipUsed = $stmt->fetchColumn() ?: 0;

        if ($ipUsed + $size > 50 * 1024 * 1024)
            throw new Exception("Daily Upload Limit Exceeded (IP)");

        // 2. Check Global
        $stmtG = $this->pdo->prepare("SELECT SUM(file_size) FROM vulnerability_attachments WHERE uploaded_at >= ?");
        $stmtG->execute([$today]);
        $globalUsed = $stmtG->fetchColumn() ?: 0;

        if ($globalUsed + $size > 1024 * 1024 * 1024)
            throw new Exception("System Storage Full - Try later");
    }

    public function uploadAttachment($reportId, $file)
    {
        // Limits
        if ($file['size'] > 5 * 1024 * 1024)
            throw new Exception("File too large (Max 5MB)");

        // Check Quotas
        // Need IP of reporter. Logic: 
        // We don't pass IP here easily unless we fetch report or pass it. 
        // Let's fetch report to get IP from payload if we stored it? 
        // Actually, we store IP in payload_json.
        $stmtR = $this->pdo->prepare("SELECT payload_json FROM vulnerability_reports WHERE report_id = ?");
        $stmtR->execute([$reportId]);
        $json = $stmtR->fetchColumn();
        $payload = json_decode($json, true);
        $ip = $payload['ip_source'] ?? '0.0.0.0';

        $this->checkUploadQuota($ip, $file['size']);

        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        $allowed = ['txt', 'pdf', 'png', 'jpg', 'zip'];
        if (!in_array($ext, $allowed))
            throw new Exception("Invalid file type");

        // Storage
        $storageDir = __DIR__ . '/../storage/vuln_uploads';
        if (!is_dir($storageDir))
            mkdir($storageDir, 0700, true);

        $hash = hash_file('sha256', $file['tmp_name']);

        // HF-57.12: Deduplication
        // If file exists, we can reuse it? Or block?
        // Blocking saves disk. "File already uploaded".
        $stmtDup = $this->pdo->prepare("SELECT 1 FROM vulnerability_attachments WHERE file_hash = ?");
        $stmtDup->execute([$hash]);
        if ($stmtDup->fetchColumn()) {
            // Optional: Return existing ID if we wanted to link it. 
            // But for security, better to just fail or pretend success?
            // Let's fail for now to save space.
            throw new Exception("Duplicate File - Already uploaded by someone.");
        }

        // HF-57.13: Magic Bytes Verification
        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $realMime = $finfo->file($file['tmp_name']);

        // Strict allowlist map
        $mimeMap = [
            'txt' => 'text/plain',
            'pdf' => 'application/pdf',
            'png' => 'image/png',
            'jpg' => 'image/jpeg',
            'zip' => 'application/zip'
        ];

        if (!isset($mimeMap[$ext]) || $mimeMap[$ext] !== $realMime) {
            throw new Exception("File Extension mismatch (Magic Bytes check failed)");
        }

        // Scan
        if (!$this->scanFile($file['tmp_name']))
            throw new Exception("Malware Detected");

        // HF-57.14: Critical Cold Storage
        // Check report severity
        $stmtSev = $this->pdo->prepare("SELECT severity FROM vulnerability_reports WHERE report_id = ?");
        $stmtSev->execute([$reportId]);
        $severity = $stmtSev->fetchColumn();

        $storageName = $hash . '.' . $ext;

        if ($severity === 'CRITICAL') {
            $storageDir .= '/critical'; // Subdir
            if (!is_dir($storageDir))
                mkdir($storageDir, 0700, true);
        }

        $target = "$storageDir/$storageName";

        if (!move_uploaded_file($file['tmp_name'], $target))
            throw new Exception("Upload Failed");

        $stmt = $this->pdo->prepare("INSERT INTO vulnerability_attachments (report_id, filename_original, filename_storage, file_hash, mime_type, file_size) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->execute([$reportId, $file['name'], $storageName, $hash, $realMime, $file['size']]);
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

        // HF-57.4: Deduplication
        $contentHash = hash('sha256', $title . $payload['description']);
        $stmtDup = $this->pdo->prepare("SELECT 1 FROM vulnerability_reports WHERE content_hash = ?");
        $stmtDup->execute([$contentHash]);
        if ($stmtDup->fetchColumn()) {
            // Shadowban duplicate? Or return error?
            // Returning specific error might leak info, but for bug bounty, "Duplicate" is standard status.
            throw new Exception("Duplicate Report Detected");
        }

        // 4. Persistence
        $stmt = $this->pdo->prepare("INSERT INTO vulnerability_reports (title, reporter_email, severity, affected_component, payload_json, content_hash) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->execute([$title, $email, $severity, $component, json_encode($payload), $contentHash]);

        $id = $this->pdo->lastInsertId();

        // 5. Audit
        $this->logger->log('VULN_REPORT_SUBMITTED', 'WARNING', ['report_id' => $id, 'severity' => $severity, 'ip' => $ip]);

        // 6. Anti-Spam: Increment Abuse Score slightly (precautionary)
        // If someone spams 100 reports, they get banned. Good researchers send 1-2.
        $this->abuseGuard->reportViolation('IP', $ip, 'VULN_SUBMISSION');

        // HF-57.2: Signed Receipt
        $receipt = [
            'report_id' => $id,
            'hash' => $contentHash,
            'timestamp' => date('c'),
            'node' => getenv('NODE_ID') ?? 'PRIMARY'
        ];

        // Sign Receipt
        $keyDir = __DIR__ . '/keys';
        if (!file_exists("$keyDir/private.pem")) {
            require_once "$keyDir/server_key_gen.php"; // Ensure keygen is available
        }
        $privKey = file_get_contents("$keyDir/private.pem");
        openssl_sign(json_encode($receipt), $signature, $privKey, OPENSSL_ALGO_SHA256);

        return [
            'id' => $id,
            'receipt' => $receipt,
            'signature' => base64_encode($signature)
        ];
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
