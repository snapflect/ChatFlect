/**
 * Chaos Test Harness
 * Epic 16: Reliability Test Harness + Chaos Simulation
 *
 * Simulates network failures, latency, duplicates, and reordering.
 * Usage: CHAOS_SEED=123 npm run test:reliability
 */

import { Observable, throwError, of, timer } from 'rxjs';
import { delay, mergeMap, tap } from 'rxjs/operators';
import seedrandom from 'seedrandom';

// ===========================================
// Configuration
// ===========================================
export interface ChaosConfig {
    latencyMean: number;    // ms
    latencyStdDev: number;  // ms
    dropRate: number;       // 0.0 - 1.0
    duplicateRate: number;  // 0.0 - 1.0
    reorderRate: number;    // 0.0 - 1.0
    seed: string;
}

export const DEFAULT_CHAOS_CONFIG: ChaosConfig = {
    latencyMean: 100,
    latencyStdDev: 50,
    dropRate: 0.05,        // 5% drop
    duplicateRate: 0.02,   // 2% duplicates
    reorderRate: 0.05,     // 5% reordering
    seed: process.env.CHAOS_SEED || 'default-seed'
};

// ===========================================
// Chaos Engine
// ===========================================
export class ChaosEngine {
    private rng: seedrandom.PRNG;
    private config: ChaosConfig;
    private metrics = {
        totalRequests: 0,
        dropped: 0,
        duplicated: 0,
        delayed: 0,
        reordered: 0
    };

    constructor(config: Partial<ChaosConfig> = {}) {
        this.config = { ...DEFAULT_CHAOS_CONFIG, ...config };
        this.rng = seedrandom(this.config.seed);
        console.log(`[ChaosEngine] Initialized with seed: "${this.config.seed}"`);
    }

    /**
     * Intercepts an Observable (HTTP request) and applies chaos.
     */
    intercept<T>(request$: Observable<T>): Observable<T> {
        this.metrics.totalRequests++;
        const rand = this.rng();

        // 1. DROP (Network Failure)
        if (rand < this.config.dropRate) {
            this.metrics.dropped++;
            return throwError(new Error('Chaos: Network Drop'));
        }

        // 2. LATENCY (Variable Delay)
        const latency = Math.max(0, this.config.latencyMean + (this.rng() - 0.5) * 2 * this.config.latencyStdDev);
        this.metrics.delayed++;

        // 3. DUPLICATE (Replay Attack / Network Echo)
        if (this.rng() < this.config.duplicateRate) {
            this.metrics.duplicated++;
            // Emit twice with delay
            return request$.pipe(
                delay(latency),
                mergeMap(val =>
                    timer(100).pipe(
                        map(() => val), // Second emission
                        startWith(val)  // First emission
                    )
                )
            ) as unknown as Observable<T>; // simplified typing for example
        }

        // 4. NORMAL (Delayed)
        return request$.pipe(delay(latency));
    }

    // Reordering logic typically requires a buffer/queue interceptor, 
    // implemented here as variable latency for simplicity which causes partial reordering.

    getMetrics() {
        return this.metrics;
    }

    resetMetrics() {
        this.metrics = {
            totalRequests: 0,
            dropped: 0,
            duplicated: 0,
            delayed: 0,
            reordered: 0
        };
    }
}

// Helper for RxJS operators (polyfill for test env if needed)
import { map, startWith } from 'rxjs/operators';
