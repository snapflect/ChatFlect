<?php
// includes/forwarding_guard.php
// Epic 84: Anti-Virality Guard

class ForwardingGuard
{
    const LIMIT_NORMAL = 5;
    const LIMIT_FREQUENT = 1;
    const THRESHOLD_FREQUENT = 5;

    public function __construct()
    {
    }

    /**
     * Check if forwarding is allowed based on source score and recipient count.
     * @param int $sourceScore The forwarding score of the ORIGINAL message.
     * @param int $recipientCount How many people we are forwarding to.
     * @throws Exception if limit exceeded.
     */
    public function checkLimit(int $sourceScore, int $recipientCount): void
    {
        // Global Hard Limit (WhatsApp style)
        if ($recipientCount > self::LIMIT_NORMAL) {
            throw new Exception("FORWARD_LIMIT_EXCEEDED: Max " . self::LIMIT_NORMAL . " recipients allowed.");
        }

        // Check Frequently Forwarded Status
        if ($this->isFrequentlyForwarded($sourceScore)) {
            if ($recipientCount > self::LIMIT_FREQUENT) {
                throw new Exception("FREQUENTLY_FORWARDED_LIMIT: Max " . self::LIMIT_FREQUENT . " recipient for frequently forwarded messages.");
            }
        }
    }

    /**
     * Calculate new score for the forwarded message.
     */
    public function calculateNewScore(int $sourceScore): int
    {
        return $sourceScore + 1;
    }

    /**
     * Determine if message is "Frequently Forwarded".
     */
    public function isFrequentlyForwarded(int $score): bool
    {
        return $score >= self::THRESHOLD_FREQUENT;
    }
}
