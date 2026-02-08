/**
 * session.test.ts
 * Epic 46: Invariant 4 (Session Key Separation)
 */

class MockSession {
    constructor(public deviceId: string, public sessionId: string) { }
}

class SessionManager {
    private sessions = new Map<string, MockSession>();

    createSession(deviceId: string): MockSession {
        const sessionId = `${deviceId}-session-${Math.random()}`;
        const session = new MockSession(deviceId, sessionId);
        this.sessions.set(deviceId, session);
        return session;
    }

    decrypt(session: MockSession, payload: any): string {
        if (payload.targetSessionId !== session.sessionId) {
            throw new Error('WRONG_SESSION');
        }
        return payload.data;
    }
}

describe('Invariant: Cross Device Session Separation', () => {
    it('should isolate sessions per device pair', () => {
        const manager = new SessionManager();

        const aliceDevice1 = manager.createSession("alice-1");
        const aliceDevice2 = manager.createSession("alice-2");

        const messageForDevice1 = { targetSessionId: aliceDevice1.sessionId, data: "secret for 1" };

        // Alice 1 can decrypt
        expect(manager.decrypt(aliceDevice1, messageForDevice1)).toBe("secret for 1");

        // Alice 2 cannot decrypt (WRONG_SESSION)
        expect(() => manager.decrypt(aliceDevice2, messageForDevice1)).toThrow('WRONG_SESSION');
    });
});
