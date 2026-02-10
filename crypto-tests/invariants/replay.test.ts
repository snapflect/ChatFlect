/**
 * replay.test.ts
 * Epic 46: Invariant 3 (Replay Protection)
 */

class ReplayProtection {
    private seenNonces = new Set<string>();

    processMessage(nonce: string): boolean {
        if (this.seenNonces.has(nonce)) {
            throw new Error('REPLAY_DETECTED');
        }
        this.seenNonces.add(nonce);
        return true;
    }
}

describe('Invariant: Replay Protection', () => {
    it('should reject replayed messages (Idempotency)', () => {
        const protector = new ReplayProtection();
        const nonce = "unique-nonce-123";

        // First attempt: Access Granted
        expect(() => protector.processMessage(nonce)).not.toThrow();

        // Second attempt: REPLAY_DETECTED
        expect(() => protector.processMessage(nonce)).toThrow('REPLAY_DETECTED');
    });

    it('should allow distinct messages', () => {
        const protector = new ReplayProtection();
        expect(() => protector.processMessage("nonce-A")).not.toThrow();
        expect(() => protector.processMessage("nonce-B")).not.toThrow();
    });
});
