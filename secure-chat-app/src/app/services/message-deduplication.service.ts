/**
 * UUIDv7 Generator and Message Deduplication Service
 * Epic 12: Idempotency + Deduplication Layer
 *
 * Provides client-side UUIDv7 generation and duplicate detection.
 */

import { Injectable } from '@angular/core';
import { get, set, keys, del } from 'idb-keyval';

// ===========================================
// Constants
// ===========================================
const PROCESSED_MESSAGES_KEY = 'processed_messages_cache';
const CACHE_MAX_SIZE = 10000; // Max messages to track
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ===========================================
// Processed Message Entry
// ===========================================
interface ProcessedMessageEntry {
    uuid: string;
    timestamp: number;
}

@Injectable({
    providedIn: 'root',
})
export class MessageDeduplicationService {
    // In-memory cache for fast lookups
    private processedCache = new Set<string>();

    constructor() {
        this.loadCacheFromStorage();
    }

    // ===========================================
    // UUIDv7 Generation (Client-Side Only)
    // ===========================================

    /**
     * Generate a new UUIDv7.
     * Uses current timestamp + random bytes for uniqueness.
     */
    generateUUIDv7(): string {
        const timestamp = Date.now();
        const randomBytes = crypto.getRandomValues(new Uint8Array(10));

        // Timestamp (48 bits, big-endian) as hex
        const timestampHex = timestamp.toString(16).padStart(12, '0');

        // Version 7 (4 bits) + random_a (12 bits)
        const randA = ((randomBytes[0] & 0x0f) << 8) | randomBytes[1];
        const versionRandA = (0x7000 | randA).toString(16).padStart(4, '0');

        // Variant (10) + random_b first byte
        const variantByte = 0x80 | (randomBytes[2] & 0x3f);
        const randB1 = (variantByte << 8) | randomBytes[3];

        // Remaining random bytes
        const randB2 = Array.from(randomBytes.slice(4))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');

        return `${timestampHex.slice(0, 8)}-${timestampHex.slice(8)}-${versionRandA}-${randB1.toString(16).padStart(4, '0')}-${randB2}`;
    }

    /**
     * Validate UUIDv7 format.
     */
    isValidUUIDv7(uuid: string): boolean {
        const pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return pattern.test(uuid);
    }

    /**
     * Extract timestamp from UUIDv7.
     */
    extractTimestamp(uuid: string): number {
        const hex = uuid.replace(/-/g, '').slice(0, 12);
        return parseInt(hex, 16);
    }

    // ===========================================
    // Deduplication Methods
    // ===========================================

    /**
     * Check if message has already been processed.
     * Returns true if DUPLICATE (should skip).
     */
    isDuplicate(uuid: string): boolean {
        return this.processedCache.has(uuid);
    }

    /**
     * Mark message as processed.
     * Call after successful message handling.
     */
    async markProcessed(uuid: string): Promise<void> {
        if (this.processedCache.has(uuid)) {
            return; // Already marked
        }

        this.processedCache.add(uuid);

        // Persist to storage
        try {
            const entries = await this.loadEntriesFromStorage();
            entries.push({ uuid, timestamp: Date.now() });

            // Cleanup old entries if over limit
            await this.persistEntries(entries);
        } catch (err) {
            console.error('Failed to persist processed message', err);
        }
    }

    /**
     * Check and mark in one atomic operation.
     * Returns true if this is a NEW message (not duplicate).
     */
    async processIfNew(uuid: string): Promise<boolean> {
        if (this.isDuplicate(uuid)) {
            console.log('MESSAGE_DUPLICATE_BLOCKED', { uuid });
            return false;
        }

        await this.markProcessed(uuid);
        return true;
    }

    // ===========================================
    // Storage Management
    // ===========================================

    private async loadCacheFromStorage(): Promise<void> {
        try {
            const entries = await this.loadEntriesFromStorage();
            const now = Date.now();

            for (const entry of entries) {
                // Only load non-expired entries
                if (now - entry.timestamp < CACHE_TTL_MS) {
                    this.processedCache.add(entry.uuid);
                }
            }

            console.log('MESSAGE_DEDUPE_CACHE_LOADED', {
                count: this.processedCache.size,
            });
        } catch (err) {
            console.error('Failed to load dedupe cache', err);
        }
    }

    private async loadEntriesFromStorage(): Promise<ProcessedMessageEntry[]> {
        try {
            const data = await get<ProcessedMessageEntry[]>(PROCESSED_MESSAGES_KEY);
            return data ?? [];
        } catch {
            return [];
        }
    }

    private async persistEntries(entries: ProcessedMessageEntry[]): Promise<void> {
        const now = Date.now();

        // Filter expired and limit size
        let filtered = entries.filter((e) => now - e.timestamp < CACHE_TTL_MS);

        // If still over limit, keep most recent
        if (filtered.length > CACHE_MAX_SIZE) {
            filtered.sort((a, b) => b.timestamp - a.timestamp);
            filtered = filtered.slice(0, CACHE_MAX_SIZE);
        }

        // Update in-memory cache
        this.processedCache.clear();
        for (const entry of filtered) {
            this.processedCache.add(entry.uuid);
        }

        await set(PROCESSED_MESSAGES_KEY, filtered);
    }

    /**
     * Clear all processed messages (for testing/reset).
     */
    async clearCache(): Promise<void> {
        this.processedCache.clear();
        await del(PROCESSED_MESSAGES_KEY);
        console.log('MESSAGE_DEDUPE_CACHE_CLEARED');
    }

    /**
     * Get cache statistics.
     */
    getCacheStats(): { size: number; maxSize: number } {
        return {
            size: this.processedCache.size,
            maxSize: CACHE_MAX_SIZE,
        };
    }
}
