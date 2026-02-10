<?php
// includes/compliance_manager.php
// Epic 54: Compliance Policy Engine
// Handles Retention Rules & Legal Hold Checks

require_once __DIR__ . '/db_connect.php';

class ComplianceManager
{
    private $pdo;
    private $settings = [];

    public function __construct($pdo)
    {
        $this->pdo = $pdo;
        $this->loadSettings();
    }

    private function loadSettings()
    {
        $stmt = $this->pdo->query("SELECT setting_key, setting_value FROM compliance_settings");
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $this->settings[$row['setting_key']] = $row['setting_value'];
        }
    }

    public function getSetting($key, $default = null)
    {
        return $this->settings[$key] ?? $default;
    }

    public function isUnderLegalHold($type, $value)
    {
        $stmt = $this->pdo->prepare("
            SELECT 1 FROM legal_holds 
            WHERE target_type = ? AND target_value = ? AND active = 1
        ");
        $stmt->execute([$type, $value]);
        return (bool) $stmt->fetchColumn();
    }

    public function createLegalHold($type, $value, $caseRef, $adminId)
    {
        $stmt = $this->pdo->prepare("
            INSERT INTO legal_holds (target_type, target_value, case_reference, created_by)
            VALUES (?, ?, ?, ?)
        ");
        $stmt->execute([$type, $value, $caseRef, $adminId]);
    }

    public function removeLegalHold($type, $value, $adminId)
    {
        $stmt = $this->pdo->prepare("
            UPDATE legal_holds SET active = 0 
            WHERE target_type = ? AND target_value = ? AND active = 1
        ");
        $stmt->execute([$type, $value]);
    }

    // Checking if we can purge a record (Generalized)
    public function canPurge($type, $value)
    {
        return !$this->isUnderLegalHold($type, $value);
    }
}
