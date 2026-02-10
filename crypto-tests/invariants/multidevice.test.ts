/**
 * multidevice.test.ts
 * Epic 47: Multi-Device Invariants
 */

class DeviceRegistry {
    private devices = new Map<string, any>();

    register(deviceId: string, trustState: 'PENDING' | 'TRUSTED' = 'PENDING') {
        this.devices.set(deviceId, { id: deviceId, trustState, revoked: false });
    }

    approve(deviceId: string) {
        const dev = this.devices.get(deviceId);
        if (dev) dev.trustState = 'TRUSTED';
    }

    revoke(deviceId: string) {
        const dev = this.devices.get(deviceId);
        if (dev) {
            dev.trustState = 'REVOKED';
            dev.revoked = true;
        }
    }

    canReceiveMessage(deviceId: string): boolean {
        const dev = this.devices.get(deviceId);
        return dev && dev.trustState === 'TRUSTED' && !dev.revoked;
    }
}

describe('Invariant: Multi-Device Security', () => {

    // Invariant: Pending devices must not receive messages
    it('should block messages to PENDING devices', () => {
        const registry = new DeviceRegistry();
        registry.register('device_new', 'PENDING');
        expect(registry.canReceiveMessage('device_new')).toBe(false);
    });

    // Invariant: Approved devices receive messages
    it('should allow messages to TRUSTED devices', () => {
        const registry = new DeviceRegistry();
        registry.register('device_trusted', 'TRUSTED');
        expect(registry.canReceiveMessage('device_trusted')).toBe(true);
    });

    // Invariant: Revoked devices are strictly cut off
    it('should immediately block REVOKED devices', () => {
        const registry = new DeviceRegistry();
        registry.register('device_stolen', 'TRUSTED');
        registry.revoke('device_stolen');
        expect(registry.canReceiveMessage('device_stolen')).toBe(false);
    });

    // Invariant: Fanout Logic (Simulation)
    it('should only fan-out to trusted set', () => {
        const registry = new DeviceRegistry();
        registry.register('d1', 'TRUSTED');
        registry.register('d2', 'PENDING');
        registry.register('d3', 'REVOKED');

        const recipients = ['d1', 'd2', 'd3'].filter(id => registry.canReceiveMessage(id));

        expect(recipients).toContain('d1');
        expect(recipients).not.toContain('d2');
        expect(recipients).not.toContain('d3');
        expect(recipients.length).toBe(1);
    });
});
