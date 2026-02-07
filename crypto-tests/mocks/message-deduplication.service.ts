/**
 * Mock for Message Deduplication Service (Jest testing)
 */

export class MessageDeduplicationService {
    private processedCache = new Set<string>();

    generateUUIDv7(): string {
        const timestamp = Date.now();
        const randomBytes = crypto.getRandomValues(new Uint8Array(10));

        const timestampHex = timestamp.toString(16).padStart(12, '0');
        const randA = ((randomBytes[0] & 0x0f) << 8) | randomBytes[1];
        const versionRandA = (0x7000 | randA).toString(16).padStart(4, '0');
        const variantByte = 0x80 | (randomBytes[2] & 0x3f);
        const randB1 = (variantByte << 8) | randomBytes[3];
        const randB2 = Array.from(randomBytes.slice(4))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');

        return `${timestampHex.slice(0, 8)}-${timestampHex.slice(8)}-${versionRandA}-${randB1.toString(16).padStart(4, '0')}-${randB2}`;
    }

    isValidUUIDv7(uuid: string): boolean {
        const pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return pattern.test(uuid);
    }

    extractTimestamp(uuid: string): number {
        const hex = uuid.replace(/-/g, '').slice(0, 12);
        return parseInt(hex, 16);
    }

    isDuplicate(uuid: string): boolean {
        return this.processedCache.has(uuid);
    }

    async markProcessed(uuid: string): Promise<void> {
        this.processedCache.add(uuid);
    }

    async processIfNew(uuid: string): Promise<boolean> {
        if (this.isDuplicate(uuid)) {
            return false;
        }
        await this.markProcessed(uuid);
        return true;
    }

    getCacheStats(): { size: number; maxSize: number } {
        return { size: this.processedCache.size, maxSize: 10000 };
    }

    async clearCache(): Promise<void> {
        this.processedCache.clear();
    }
}
