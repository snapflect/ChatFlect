<?php
// includes/rate_limiter.php
// Central Token Bucket Rate Limiter (Epic 52)
// Backed by MySQL (rate_limit_buckets)

class RateLimiter
{
    private $pdo;

    public function __construct($pdo)
    {
        $this->pdo = $pdo;
    }

    /**
     * Consume tokens from a bucket.
     * Returns TRUE if allowed, FALSE if limit exceeded.
     * 
     * @param string $key Unique bucket identifier (e.g. "IP:1.2.3.4:AUTH")
     * @param int $capacity Max tokens (burst size)
     * @param float $refillRate Tokens per second
     * @param int $cost Tokens to consume for this op
     */
    public function consume($key, $capacity, $refillRate, $cost = 1)
    {
        $now = time();
        $bucketKey = md5($key);

        // 1. Fetch current state
        $stmt = $this->pdo->prepare("SELECT tokens, last_updated FROM rate_limit_buckets WHERE bucket_key = ?");
        $stmt->execute([$bucketKey]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($row) {
            $tokens = (float) $row['tokens'];
            $lastUpdated = strtotime($row['last_updated']);

            // Refill
            $delta = $now - $lastUpdated;
            $tokens = min($capacity, $tokens + ($delta * $refillRate));
        } else {
            $tokens = $capacity; // Start full
        }

        // 2. Check & Consume
        if ($tokens >= $cost) {
            $tokens -= $cost;
            $allowed = true;
        } else {
            $allowed = false;
        }

        // 3. Save State (Upsert)
        $expires = date('Y-m-d H:i:s', $now + 3600); // Auto-expire bucket after 1h idle
        $sql = "INSERT INTO rate_limit_buckets (bucket_key, tokens, last_updated, expires_at) 
                VALUES (?, ?, NOW(), ?) 
                ON DUPLICATE KEY UPDATE tokens = VALUES(tokens), last_updated = NOW(), expires_at = VALUES(expires_at)";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$bucketKey, $tokens, $expires]);

        return $allowed;
    }
}
