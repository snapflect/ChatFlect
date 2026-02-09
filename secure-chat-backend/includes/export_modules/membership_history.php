<?php
// includes/export_modules/membership_history.php

function getMembershipHistory($pdo, $orgIdBin, $start, $end)
{
    // Return current roster + historical changes if tracked
    // For now, snapshot of current members
    $stmt = $pdo->prepare("
        SELECT u.id, u.username, u.email, m.role, m.joined_at, m.status
        FROM org_members m
        JOIN users u ON m.user_id = u.id
        WHERE m.org_id = ? AND m.joined_at <= ?
    ");
    $stmt->execute([$orgIdBin, $end]);
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}
