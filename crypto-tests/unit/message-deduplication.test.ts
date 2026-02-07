/**
 * Unit Tests for Message Deduplication Service
 * Epic 12: Idempotency + Deduplication Layer
 */

import { MessageDeduplicationService } from '../mocks/message-deduplication.service';

describe('MessageDeduplicationService', () => {
    let service: MessageDeduplicationService;

    beforeEach(() => {
        service = new MessageDeduplicationService();
    });

    // ===========================================
    // UUIDv7 Generation
    // ===========================================
    describe('generateUUIDv7', () => {
        it('should generate valid UUIDv7 format', () => {
            const uuid = service.generateUUIDv7();
            expect(service.isValidUUIDv7(uuid)).toBe(true);
        });

        it('should generate unique UUIDs', () => {
            const uuids = new Set<string>();
            for (let i = 0; i < 1000; i++) {
                uuids.add(service.generateUUIDv7());
            }
            expect(uuids.size).toBe(1000);
        });

        it('should have version 7 in correct position', () => {
            const uuid = service.generateUUIDv7();
            const versionChar = uuid.charAt(14);
            expect(versionChar).toBe('7');
        });

        it('should have correct variant (8, 9, a, or b)', () => {
            const uuid = service.generateUUIDv7();
            const variantChar = uuid.charAt(19);
            expect(['8', '9', 'a', 'b']).toContain(variantChar.toLowerCase());
        });

        it('should be sortable by time', () => {
            const uuid1 = service.generateUUIDv7();
            // Simulate time passing
            const uuid2 = service.generateUUIDv7();

            // String comparison should maintain time order
            expect(uuid2 >= uuid1).toBe(true);
        });
    });

    // ===========================================
    // UUID Validation
    // ===========================================
    describe('isValidUUIDv7', () => {
        it('should accept valid UUIDv7', () => {
            expect(service.isValidUUIDv7('01913b8f-5c04-7e7a-8312-5f4e9c3a1b2d')).toBe(true);
        });

        it('should reject UUIDv4', () => {
            expect(service.isValidUUIDv7('550e8400-e29b-41d4-a716-446655440000')).toBe(false);
        });

        it('should reject invalid format', () => {
            expect(service.isValidUUIDv7('not-a-uuid')).toBe(false);
            expect(service.isValidUUIDv7('')).toBe(false);
            expect(service.isValidUUIDv7('01913b8f-5c04-7e7a-8312')).toBe(false);
        });
    });

    // ===========================================
    // Timestamp Extraction
    // ===========================================
    describe('extractTimestamp', () => {
        it('should extract timestamp from UUIDv7', () => {
            const now = Date.now();
            const uuid = service.generateUUIDv7();
            const extracted = service.extractTimestamp(uuid);

            // Should be within 1 second of now
            expect(Math.abs(extracted - now)).toBeLessThan(1000);
        });
    });

    // ===========================================
    // Deduplication
    // ===========================================
    describe('deduplication', () => {
        it('should detect duplicate on second call', async () => {
            const uuid = service.generateUUIDv7();

            expect(service.isDuplicate(uuid)).toBe(false);
            await service.markProcessed(uuid);
            expect(service.isDuplicate(uuid)).toBe(true);
        });

        it('should process new message only once', async () => {
            const uuid = service.generateUUIDv7();

            const first = await service.processIfNew(uuid);
            const second = await service.processIfNew(uuid);

            expect(first).toBe(true);
            expect(second).toBe(false);
        });

        it('should handle multiple unique messages', async () => {
            const uuid1 = service.generateUUIDv7();
            const uuid2 = service.generateUUIDv7();

            await service.markProcessed(uuid1);

            expect(service.isDuplicate(uuid1)).toBe(true);
            expect(service.isDuplicate(uuid2)).toBe(false);
        });
    });

    // ===========================================
    // Cache Stats
    // ===========================================
    describe('getCacheStats', () => {
        it('should return correct cache size', async () => {
            await service.markProcessed(service.generateUUIDv7());
            await service.markProcessed(service.generateUUIDv7());

            const stats = service.getCacheStats();
            expect(stats.size).toBe(2);
        });
    });
});
