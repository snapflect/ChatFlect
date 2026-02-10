<?php
/**
 * Optimized MySQL-backed Caching Service
 * Provides sub-100ms caching of expensive queries and session metadata
 */
class CacheService
{
    private static $instance = null;

    public static function get($key)
    {
        global $conn;
        $stmt = $conn->prepare("SELECT cache_value FROM cache_store WHERE cache_key = ? AND expires_at > NOW()");
        $stmt->bind_param("s", $key);
        $stmt->execute();
        $res = $stmt->get_result();
        if ($row = $res->fetch_assoc()) {
            $decoded = json_decode($row['cache_value'], true);
            // v8 Refined: Return only data if it's a metadata-wrapped entry
            if (is_array($decoded) && isset($decoded['__data'])) {
                return $decoded['__data'];
            }
            return $decoded;
        }
        return null;
    }

    public static function set($key, $value, $ttlSeconds = 3600, $metadata = null)
    {
        global $conn;

        // v8 Refined: Wrap value if metadata is provided for forensics
        $dataToStore = $value;
        if ($metadata !== null) {
            $dataToStore = [
                '__data' => $value,
                '__meta' => $metadata,
                '__timestamp' => time()
            ];
        }

        $jsonValue = json_encode($dataToStore);
        $expiresAt = date('Y-m-d H:i:s', time() + $ttlSeconds);

        $stmt = $conn->prepare("INSERT INTO cache_store (cache_key, cache_value, expires_at) 
                                VALUES (?, ?, ?) 
                                ON DUPLICATE KEY UPDATE cache_value = ?, expires_at = ?");
        $stmt->bind_param("sssss", $key, $jsonValue, $expiresAt, $jsonValue, $expiresAt);
        return $stmt->execute();
    }

    public static function delete($key)
    {
        global $conn;
        $stmt = $conn->prepare("DELETE FROM cache_store WHERE cache_key = ?");
        $stmt->bind_param("s", $key);
        return $stmt->execute();
    }

    // v12: Pattern-based invalidation
    public static function invalidate($pattern)
    {
        global $conn;
        // WARNING: Ensure pattern is sanitized in usage or limited to internal calls.
        $stmt = $conn->prepare("DELETE FROM cache_store WHERE cache_key LIKE ?");
        $stmt->bind_param("s", $pattern);
        return $stmt->execute();
    }

    /* --- Session Specific Cache Helpers --- */

    public static function cacheSession($jti, $userId, $metadata = [])
    {
        $data = [
            'user_id' => $userId,
            'metadata' => $metadata
        ];
        return self::set("session:$jti", $data, 86400); // 24h
    }

    public static function getSession($jti)
    {
        return self::get("session:$jti");
    }

    /* --- User Existence Cache --- */

    public static function cacheUserExistence($emailOrPhone, $exists = true)
    {
        // Cache for 1 hour to prevent brute force/spam checks hitting DB
        return self::set("user_exists:$emailOrPhone", $exists, 3600);
    }

    public static function checkUserExists($emailOrPhone)
    {
        return self::get("user_exists:$emailOrPhone");
    }
}
?>