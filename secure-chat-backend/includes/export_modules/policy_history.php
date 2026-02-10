<?php
// includes/export_modules/policy_history.php

function getPolicyHistory($pdo, $orgIdBin)
{
    $stmt = $pdo->prepare("SELECT version, policy_json, created_at, created_by_user_id FROM org_policies WHERE org_id = ? ORDER BY version ASC");
    $stmt->execute([$orgIdBin]);
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}
