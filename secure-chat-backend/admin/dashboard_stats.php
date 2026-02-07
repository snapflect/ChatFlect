<?php
/**
 * Admin Dashboard Stats (Read-Only)
 * Epic 22: Performance Optimization
 */

require_once __DIR__ . '/../includes/db_connect.php';
// require_once __DIR__ . '/../api/auth_middleware.php'; 
// NOTE: Admin endpoints usually require stricter auth (e.g., ADMIN_SECRET check).
// For validation phase, we'll assume a basic check or run locally.

header('Content-Type: application/json');

// 1. Message Count (24h)
$sql24h = "SELECT COUNT(*) as count FROM messages WHERE created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)";
$stmt = $pdo->query($sql24h);
$msg24h = $stmt->fetch(PDO::FETCH_ASSOC)['count'];

// 2. Total DB Size (Messages)
// MySQL specific approximation
$sqlSize = "
    SELECT 
        ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS size_mb 
    FROM information_schema.tables 
    WHERE table_schema = DATABASE() 
    AND table_name = 'messages'
";
$stmt = $pdo->query($sqlSize);
$dbSize = $stmt->fetch(PDO::FETCH_ASSOC)['size_mb'];

// 3. Receipt Count
$sqlReceipts = "SELECT COUNT(*) as count FROM receipts";
$stmt = $pdo->query($sqlReceipts);
$totalReceipts = $stmt->fetch(PDO::FETCH_ASSOC)['count'];

// 4. Latency Snapshot (Mock/Placeholder or Redis if available)
// Ideally we pull from 'performance_logs' table if we created one.
// We'll return placeholders for now as per plan to implement logging later.

echo json_encode([
    'timestamp' => time(),
    'metrics' => [
        'messages_24h' => (int) $msg24h,
        'db_size_mb' => (float) $dbSize,
        'total_receipts' => (int) $totalReceipts,
        // 'p95_latency_ms' => 'N/A' // To be implemented via logs
    ]
], JSON_PRETTY_PRINT);
