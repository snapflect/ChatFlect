<?php
// api/v4/public/trust/governance_policy.php
// Epic 59: Governance Policy Transparency
// Exposes sanitized policy rules (which actions need what approval).

require_once __DIR__ . '/../../../../includes/db_connect.php';

header('Content-Type: application/json');
header('Cache-Control: max-age=86400'); // Cache for 1 day

$stmt = $pdo->query("SELECT action_type, description, min_approvers, required_role FROM governance_policies");
$policies = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo json_encode([
    'governance_model' => 'Multi-Party Approval',
    'policies' => $policies
], JSON_PRETTY_PRINT);
