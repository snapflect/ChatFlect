<?php
// includes/privacy_event_logger.php
// Epic 71: Unified Logger for Privacy Events

require_once __DIR__ . '/db_connect.php';

class PrivacyEventLogger
{
    private $pdo;

    public function __construct($pdo)
    {
        $this->pdo = $pdo;
    }

    public function logEvent($convIdBin, $userId, $deviceId, $type, $platform)
    {
        $stmt = $this->pdo->prepare("INSERT INTO privacy_events (conversation_id, user_id, device_id, event_type, platform) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([$convIdBin, $userId, $deviceId, $type, $platform]);

        // Optional: Trigger System Message in Chat?
        // "User X took a screenshot"
        // This would require inserting into `messages` table as SYSTEM type.
        // For Epic 71, we just log and maybe API returns success. The "Alerts" part is UI/feature logic.
        // Let's implement a helper to inject system message if needed.
    }

    public function broadcastAlert($convIdBin, $userId, $type)
    {
        // Mock function to insert a System Message
        // In real app, this inserts into `messages` table.
        // Simplified for this task.
    }
}
