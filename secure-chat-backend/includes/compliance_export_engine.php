<?php
// includes/compliance_export_engine.php
// Epic 63: Core Export Engine

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/env.php';

class ComplianceExportEngine
{
    private $pdo;
    private $exportDir;

    public function __construct($pdo)
    {
        $this->pdo = $pdo;
        $this->exportDir = __DIR__ . '/../exports/compliance'; // Ensure this exists and is secured
        if (!is_dir($this->exportDir))
            mkdir($this->exportDir, 0700, true);
    }

    public function createExportJob($orgIdBin, $userId, $startDate, $endDate)
    {
        // Use UUID v4
        $exportIdHex = sprintf(
            '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000,
            mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0xffff)
        );
        $exportIdBin = hex2bin($exportIdHex);

        $stmt = $this->pdo->prepare("INSERT INTO compliance_exports (export_id, org_id, requested_by_user_id, start_date, end_date, status) VALUES (?, ?, ?, ?, ?, 'PENDING')");
        $stmt->execute([$exportIdBin, $orgIdBin, $userId, $startDate, $endDate]);

        return $exportIdHex;
    }

    public function processExport($exportIdHex)
    {
        $exportIdBin = hex2bin($exportIdHex);

        // Update Status to PROCESSING
        $stmt = $this->pdo->prepare("UPDATE compliance_exports SET status='PROCESSING' WHERE export_id = ?");
        $stmt->execute([$exportIdBin]);

        try {
            // Fetch Job Details
            $stmt = $this->pdo->prepare("SELECT * FROM compliance_exports WHERE export_id = ?");
            $stmt->execute([$exportIdBin]);
            $job = $stmt->fetch(PDO::FETCH_ASSOC);
            $orgIdBin = $job['org_id'];

            // Prepare ZIP
            $zipPath = $this->exportDir . '/ORG-COMPLIANCE-' . $exportIdHex . '.zip';
            $zip = new ZipArchive();
            if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== TRUE) {
                throw new Exception("Cannot create ZIP file");
            }

            $manifest = [
                'export_id' => $exportIdHex,
                'org_id' => bin2hex($orgIdBin),
                'generated_at' => date('c'),
                'files' => []
            ];

            // 1. Members Module
            $members = $this->runModule('members', $orgIdBin, $job);
            $this->addToZip($zip, 'members.json', $members, $manifest);

            // 2. Devices Module
            $devices = $this->runModule('devices', $orgIdBin, $job);
            $this->addToZip($zip, 'devices.json', $devices, $manifest);

            // 3. Policies 
            $policies = $this->runModule('policies', $orgIdBin, $job);
            $this->addToZip($zip, 'policies.json', $policies, $manifest);

            // 4. Audit
            $audit = $this->runModule('audit', $orgIdBin, $job);
            $this->addToZip($zip, 'audit.json', $audit, $manifest);

            // 5. Manifest
            $zip->addFromString('manifest.json', json_encode($manifest, JSON_PRETTY_PRINT));

            // 6. Signature (Sign the manifest)
            $sig = $this->signData(json_encode($manifest));
            $zip->addFromString('signature.sig', $sig);

            $zip->close();

            // Finalize
            $hash = hash_file('sha256', $zipPath);
            $stmt = $this->pdo->prepare("UPDATE compliance_exports SET status='COMPLETED', file_path=?, file_hash=?, signature=?, completed_at=NOW() WHERE export_id=?");
            $stmt->execute([$zipPath, $hash, base64_encode($sig), $exportIdBin]);

        } catch (Exception $e) {
            $stmt = $this->pdo->prepare("UPDATE compliance_exports SET status='FAILED', error_message=? WHERE export_id=?");
            $stmt->execute([$e->getMessage(), $exportIdBin]);
            throw $e;
        }
    }

    private function runModule($name, $orgIdBin, $job)
    {
        // Dynamic include/execution based on name (Factory pattern or simple switch)
        // Simplified for snippet:
        switch ($name) {
            case 'members':
                require_once __DIR__ . '/export_modules/membership_history.php';
                return getMembershipHistory($this->pdo, $orgIdBin, $job['start_date'], $job['end_date']);
            case 'devices':
                require_once __DIR__ . '/export_modules/device_registry.php';
                return getDeviceRegistry($this->pdo, $orgIdBin, $job['start_date'], $job['end_date']);
            case 'policies':
                require_once __DIR__ . '/export_modules/policy_history.php';
                return getPolicyHistory($this->pdo, $orgIdBin);
            case 'audit':
                require_once __DIR__ . '/export_modules/audit_feed.php';
                return getAuditFeed($this->pdo, $orgIdBin, $job['start_date'], $job['end_date']);
            default:
                return [];
        }
    }

    private function addToZip($zip, $filename, $data, &$manifest)
    {
        $json = json_encode($data, JSON_PRETTY_PRINT);
        $zip->addFromString($filename, $json);
        $manifest['files'][$filename] = [
            'hash' => hash('sha256', $json),
            'size' => strlen($json)
        ];
    }

    private function signData($data)
    {
        $privateKeyPath = __DIR__ . '/../../keys/server_private.pem';
        if (file_exists($privateKeyPath)) {
            $pkey = openssl_pkey_get_private(file_get_contents($privateKeyPath));
            openssl_sign($data, $signature, $pkey, OPENSSL_ALGO_SHA256);
            return $signature;
        }
        return "UNSIGNED_DEV";
    }
}
