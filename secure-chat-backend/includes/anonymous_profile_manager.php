<?php
// includes/anonymous_profile_manager.php
// Epic 74: Anonymous Profile Logic

require_once __DIR__ . '/db_connect.php';

class AnonymousProfileManager
{
    private $pdo;

    public function __construct($pdo)
    {
        $this->pdo = $pdo;
    }

    public function enableAnonymousMode($userId, $conversationId, $aliasName)
    {
        // Ensure alias is unique within the conversation? 
        // Or just unique for that user?
        // Usually, aliases should be unique in a group to avoid confusion.
        // For 1:1, it matters less, but "Ghost-91" vs "Ghost-91" is bad.
        // Let's enforce user-specific setting first.

        $convIdBin = hex2bin($conversationId);

        $stmt = $this->pdo->prepare("
            INSERT INTO anonymous_profiles (user_id, conversation_id, alias_name, is_anonymous) 
            VALUES (?, ?, ?, TRUE)
            ON DUPLICATE KEY UPDATE alias_name=VALUES(alias_name), is_anonymous=TRUE
        ");
        $stmt->execute([$userId, $convIdBin, $aliasName]);
    }

    public function disableAnonymousMode($userId, $conversationId)
    {
        $convIdBin = hex2bin($conversationId);
        $stmt = $this->pdo->prepare("UPDATE anonymous_profiles SET is_anonymous=FALSE WHERE user_id=? AND conversation_id=?");
        $stmt->execute([$userId, $convIdBin]);
    }

    public function getProfile($userId, $conversationId)
    {
        $convIdBin = hex2bin($conversationId);
        $stmt = $this->pdo->prepare("SELECT alias_name, is_anonymous FROM anonymous_profiles WHERE user_id=? AND conversation_id=?");
        $stmt->execute([$userId, $convIdBin]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    // Helper to get DISPLAY info allowed for a viewer
    public function getDisplayInfo($targetUserId, $conversationId)
    {
        $profile = $this->getProfile($targetUserId, $conversationId);

        if ($profile && $profile['is_anonymous']) {
            return [
                'user_id' => 'ANON-' . substr(md5($targetUserId . $conversationId), 0, 8), // Masked ID
                'display_name' => $profile['alias_name'],
                'is_anonymous' => true
            ];
        }

        // Return real info (Mock)
        return [
            'user_id' => $targetUserId,
            'display_name' => 'Real User Name', // Fetch from users table
            'is_anonymous' => false
        ];
    }
}
