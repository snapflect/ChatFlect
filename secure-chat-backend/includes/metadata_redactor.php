<?php
// includes/metadata_redactor.php
// Epic 74: Metadata Redaction

require_once __DIR__ . '/db_connect.php';

class MetadataRedactor
{
    private $pdo;
    private $policies = [];

    public function __construct($pdo)
    {
        $this->pdo = $pdo;
        $this->loadPolicies();
    }

    private function loadPolicies()
    {
        $stmt = $this->pdo->query("SELECT field_name, redaction_type, replacement_value FROM redaction_policies WHERE is_active=TRUE");
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $this->policies[$row['field_name']] = $row;
        }
    }

    public function redact($data)
    {
        if (!is_array($data))
            return $data;

        $redacted = $data;
        foreach ($data as $key => $value) {
            // Check direct match
            if (isset($this->policies[$key])) {
                $policy = $this->policies[$key];
                $redacted[$key] = $this->applyPolicy($value, $policy);
            }
            // Check nested arrays (recursive)
            elseif (is_array($value)) {
                $redacted[$key] = $this->redact($value);
            }
        }
        return $redacted;
    }

    private function applyPolicy($value, $policy)
    {
        switch ($policy['redaction_type']) {
            case 'REMOVE':
                return null;
            case 'HASH':
                return hash('sha256', $value); // Simplistic hash
            case 'MASK':
            default:
                return $policy['replacement_value'] ?: '[REDACTED]';
        }
    }
}
