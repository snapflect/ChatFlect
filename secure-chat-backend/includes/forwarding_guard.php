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
     * @param string|null $orgId Optional Org ID for policy override.
     * @throws Exception if limit exceeded.
     */
    public function checkLimit(int $sourceScore, int $recipientCount, $orgId = null): void
    {
        $limitNormal = self::LIMIT_NORMAL;
        $limitFrequent = self::LIMIT_FREQUENT;

        // HF-84.3: Org Policy Override
        if ($orgId) {
            // Mock fetching from DB or JSON
            // $policy = OrgPolicyManager::getPolicy($orgId, 'forwarding');
            // $limitNormal = $policy['limit_normal'] ?? self::LIMIT_NORMAL;
        }

        // Global Hard Limit
        if ($recipientCount > $limitNormal) {
            throw new Exception("FORWARD_LIMIT_EXCEEDED: Max $limitNormal recipients allowed.");
        }

        // Check Frequently Forwarded Status
        if ($this->isFrequentlyForwarded($sourceScore)) {
            if ($recipientCount > $limitFrequent) {
                throw new Exception("FREQUENTLY_FORWARDED_LIMIT: Max $limitFrequent recipient for frequently forwarded messages.");
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
