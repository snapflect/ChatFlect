/**
 * versioning.test.ts
 * Epic 46: Invariant 10 (Protocol Versioning)
 */

class ProtocolHandler {
    private supportedVersions = [1];

    processMessage(payload: { version: number, data: string }) {
        if (!this.supportedVersions.includes(payload.version)) {
            throw new Error('UNSUPPORTED_PROTOCOL_VERSION');
        }
        return `Processed v${payload.version}`;
    }
}

describe('Invariant: Protocol Versioning', () => {
    it('should accept supported version', () => {
        const handler = new ProtocolHandler();
        expect(handler.processMessage({ version: 1, data: 'test' })).toBe('Processed v1');
    });

    it('should reject unsupported future version', () => {
        const handler = new ProtocolHandler();
        expect(() => handler.processMessage({ version: 2, data: 'test' })).toThrow('UNSUPPORTED_PROTOCOL_VERSION');
    });

    it('should reject legacy version if not supported', () => {
        const handler = new ProtocolHandler();
        expect(() => handler.processMessage({ version: 0, data: 'test' })).toThrow('UNSUPPORTED_PROTOCOL_VERSION');
    });
});
