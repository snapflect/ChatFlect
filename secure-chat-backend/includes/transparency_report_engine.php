<?php
// includes/transparency_report_engine.php
// Epic 56: Transparency Report Engine
// Aggregates statistics from various tables for the reporting period.

require_once __DIR__ . '/db_connect.php';

class TransparencyReportEngine
{
    private $pdo;

    public function __construct($pdo)
    {
        $this->pdo = $pdo;
    }

    public function generateReport($startDate, $endDate)
    {
        $stats = [
            'header' => [
                'period_start' => $startDate,
                'period_end' => $endDate,
                'generated_at' => date('c'),
                'node_id' => getenv('NODE_ID') ?? 'PRIMARY'
            ],
            'security_stats' => $this->getSecurityStats($startDate, $endDate),
            'compliance_stats' => $this->getComplianceStats($startDate, $endDate),
            'forensics_stats' => $this->getForensicsStats($startDate, $endDate),
            'integrity_stats' => $this->getIntegrityStats($startDate, $endDate)
        ];

        return $stats;
    }

    private function getSecurityStats($start, $end)
    {
        // Bans
        $stmtBan = $this->pdo->prepare("SELECT COUNT(*) FROM ip_banlist WHERE created_at BETWEEN ? AND ?");
        $stmtBan->execute([$start, $end]);
        $totalBans = $stmtBan->fetchColumn();

        // Rate Limits (approximate from audit logs if we logged them, or bucket analytics if we stored history)
        // Using audit log 'RATE_LIMIT_EXCEEDED'
        $stmtRl = $this->pdo->prepare("SELECT COUNT(*) FROM security_audit_log WHERE event_type = 'RATE_LIMIT_EXCEEDED' AND created_at BETWEEN ? AND ?");
        $stmtRl->execute([$start, $end]);

        return [
            'total_bans' => (int) $totalBans,
            'rate_limit_hits' => (int) $stmtRl->fetchColumn()
        ];
    }

    private function getComplianceStats($start, $end)
    {
        // GDPR Jobs
        $stmtDel = $this->pdo->prepare("SELECT COUNT(*) FROM gdpr_delete_jobs WHERE started_at BETWEEN ? AND ? AND status = 'DONE'");
        $stmtDel->execute([$start, $end]);

        // Legal Holds
        $stmtHold = $this->pdo->prepare("SELECT COUNT(*) FROM legal_holds WHERE created_at BETWEEN ? AND ?");
        $stmtHold->execute([$start, $end]);

        return [
            'gdpr_deletions_completed' => (int) $stmtDel->fetchColumn(),
            'legal_holds_created' => (int) $stmtHold->fetchColumn()
        ];
    }

    private function getForensicsStats($start, $end)
    {
        // Count 'CASE_EXPORT_GENERATED' events
        $stmtCase = $this->pdo->prepare("SELECT COUNT(*) FROM security_audit_log WHERE event_type = 'CASE_EXPORT_GENERATED' AND created_at BETWEEN ? AND ?");
        $stmtCase->execute([$start, $end]);
        return ['case_exports' => (int) $stmtCase->fetchColumn()];
    }

    private function getIntegrityStats($start, $end)
    {
        // Placeholder check 
        return ['audit_chain_errors' => 0];
    }

    public function saveReport($stats)
    {
        $json = json_encode($stats);
        $hash = hash('sha256', $json);

        // Sign
        $keyDir = __DIR__ . '/keys';
        if (!file_exists("$keyDir/private.pem")) {
            require_once "$keyDir/server_key_gen.php";
        }
        $privKey = file_get_contents("$keyDir/private.pem");
        openssl_sign($hash, $sig, $privKey, OPENSSL_ALGO_SHA256);
        $base64Sig = base64_encode($sig);

        $stmt = $this->pdo->prepare("INSERT INTO transparency_reports (period_start, period_end, report_json, integrity_hash, signature) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([
            $stats['header']['period_start'],
            $stats['header']['period_end'],
            $json,
            $hash,
            $base64Sig
        ]);

        return $this->pdo->lastInsertId();
    }
}
