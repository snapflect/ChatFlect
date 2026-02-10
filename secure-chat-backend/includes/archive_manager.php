<?php
// includes/archive_manager.php
// Epic 64: Archive Tier Logic

require_once __DIR__ . '/db_connect.php';

class ArchiveManager
{
    private $pdo;
    private $archiveDir;

    public function __construct($pdo)
    {
        $this->pdo = $pdo;
        $this->archiveDir = __DIR__ . '/../archives/tier1'; // Secure storage
        if (!is_dir($this->archiveDir))
            mkdir($this->archiveDir, 0700, true);
    }

    public function createMonthlySnapshot($orgIdBin)
    {
        // Generate Immutable Snapshot
        $snapshotIdHex = bin2hex(random_bytes(16));
        $snapshotIdBin = hex2bin($snapshotIdHex);
        $date = date('Y-m-d');

        // 1. Create Record
        $stmt = $this->pdo->prepare("INSERT INTO archive_snapshots (snapshot_id, org_id, snapshot_date, status) VALUES (?, ?, ?, 'GENERATING')");
        $stmt->execute([$snapshotIdBin, $orgIdBin, $date]);

        // 2. Gather Data (Audit tips, Policy state, etc.)
        // (Simplified for prototype: Just save Policy + Audit Tip)
        $data = [
            'org_id' => bin2hex($orgIdBin),
            'date' => $date,
            'policy_state' => '...', // Fetch current policy
            'audit_tip' => '...' // Fetch last audit hash
        ];

        $json = json_encode($data);
        $path = $this->archiveDir . '/' . $snapshotIdHex . '.json.enc';

        // Encrypt
        $key = getenv('ARCHIVE_ENCRYPTION_KEY') ?: 'mock_key_32_bytes_long_1234567890';
        $iv = openssl_random_pseudo_bytes(16);
        $encrypted = openssl_encrypt($json, 'aes-256-cbc', $key, 0, $iv);
        file_put_contents($path, $iv . $encrypted);

        // Sign
        $sig = "MOCK_SIG"; // Use OpenSSL to sign
        $hash = hash_file('sha256', $path);

        // 3. Finalize
        $stmt = $this->pdo->prepare("UPDATE archive_snapshots SET status='STORED', file_path=?, file_hash=?, signature=? WHERE snapshot_id=?");
        $stmt->execute([$path, $hash, $sig, $snapshotIdBin]);

        return $snapshotIdHex;
    }
}
