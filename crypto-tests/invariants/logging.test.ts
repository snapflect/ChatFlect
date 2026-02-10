/**
 * logging.test.ts
 * Epic 46: Invariant 9 (No Key Material Logging)
 */

class SecureLogger {
    private logs: string[] = [];

    // Patterns that look like keys/secrets (Hex/Base64 of certain lengths)
    // Real implementation would be more robust
    private secretPatterns = [
        /privateKey/i,
        /sessionKey/i,
        /secret/i,
        /[a-f0-9]{64}/i, // 32-byte hex
        /[a-zA-Z0-9+/]{44}/ // 32-byte base64
    ];

    log(message: string, context?: any) {
        const fullMsg = `${message} ${JSON.stringify(context || {})}`;

        for (const pattern of this.secretPatterns) {
            if (pattern.test(fullMsg)) {
                throw new Error('SECURITY_VIOLATION: Attempted to log potential secret material');
            }
        }

        this.logs.push(fullMsg);
    }
}

describe('Invariant: No Key Material Logging', () => {
    it('should allow safe non-sensitive logs', () => {
        const logger = new SecureLogger();
        expect(() => logger.log('User logged in', { userId: '123' })).not.toThrow();
    });

    it('should block logging of private keys', () => {
        const logger = new SecureLogger();
        expect(() => logger.log('Key generated', { privateKey: 'deadbeef...' })).toThrow('SECURITY_VIOLATION');
    });

    it('should block logging of raw secrets', () => {
        const logger = new SecureLogger();
        // 32-byte random hex string
        const secret = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';
        expect(() => logger.log('Secret value:', secret)).toThrow('SECURITY_VIOLATION');
    });
});
