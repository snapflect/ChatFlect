import { Injectable, Injector } from '@angular/core';
import { Platform } from '@ionic/angular';
import { BehaviorSubject } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { LocalDbService } from './local-db.service';
import { AuthService } from './auth.service';
import { LoggingService } from './logging.service';
import { SplashScreen } from '@capacitor/splash-screen';

import { ChatService } from './chat.service';
import { SyncService } from './sync.service';
import { RetrySchedulerService } from './retry-scheduler.service';
import { MessageAckService } from './message-ack.service';
import { CallService } from './call.service';
import { PushService } from './push.service';

export enum BootStage {
    IDLE = 'BOOT_IDLE',
    PLATFORM_READY = 'BOOT_PLATFORM_READY',
    VAULT_READY = 'BOOT_VAULT_READY',
    AUTH_READY = 'BOOT_AUTH_READY',
    SYNC_READY = 'BOOT_SYNC_READY',
    ENGINES_READY = 'BOOT_ENGINES_READY',
    COMPLETE = 'BOOT_COMPLETE',
    SAFE_MODE = 'BOOT_SAFE_MODE',
    FAILED = 'BOOT_FAILED'
}

export interface BootError {
    type: 'BOOT_TIMEOUT' | 'BOOT_FAIL';
    message: string;
}

@Injectable({
    providedIn: 'root'
})
export class AppInitService {
    public bootState$ = new BehaviorSubject<BootStage>(BootStage.IDLE);

    // Emit true when boot is COMPLETE or SAFE_MODE (biometric failed → allow login)
    public initialized$ = this.bootState$.pipe(
        filter(s => s === BootStage.COMPLETE || s === BootStage.SAFE_MODE),
        map(() => true)
    );

    private bootErrorSubject = new BehaviorSubject<BootError | null>(null);
    public bootError$ = this.bootErrorSubject.asObservable();

    private bootStarted = false;
    private bootRunning = false; // Signal-style mutex: prevents concurrent boot
    private bootRetryCount = 0;
    private readonly MAX_BOOT_RETRIES = 3;
    private bootWatchdogTimer: any;

    constructor(
        private platform: Platform,
        private localDb: LocalDbService,
        private auth: AuthService,
        private logger: LoggingService,
        private injector: Injector
    ) { }

    async retry() {
        this.bootErrorSubject.next(null);
        this.bootStarted = false;
        this.bootRunning = false;
        this.bootRetryCount = 0;
        this.bootState$.next(BootStage.IDLE); // Reset to allow re-entry past terminal state guards
        return this.init();
    }

    private watchdogPaused = false;

    public pauseWatchdog() {
        this.watchdogPaused = true;
        this.logger.log('[BootWatchdog] Paused');
    }

    public resumeWatchdog() {
        this.watchdogPaused = false;
        this.logger.log('[BootWatchdog] Resumed');
    }

    private startBootWatchdog() {
        if (this.bootWatchdogTimer) {
            clearTimeout(this.bootWatchdogTimer);
        }

        this.bootWatchdogTimer = setTimeout(() => {
            if (this.watchdogPaused) {
                // Reschedule if paused
                this.startBootWatchdog();
                return;
            }

            const state = this.bootState$.value;
            if (state !== BootStage.COMPLETE && state !== BootStage.FAILED && state !== BootStage.SAFE_MODE) {
                if (this.bootRetryCount >= this.MAX_BOOT_RETRIES) {
                    this.logger.error('[BootWatchdog] Max retries reached. Boot permanently failed.');
                    this.bootState$.next(BootStage.FAILED);
                    this.bootErrorSubject.next({ type: 'BOOT_TIMEOUT', message: 'Max boot retries reached.' });
                    return;
                }

                this.bootRetryCount++;
                this.logger.warn(`[BootWatchdog] Boot stalled at state: ${state}. Attempting recovery ${this.bootRetryCount}/${this.MAX_BOOT_RETRIES}...`);
                this.recoverBoot();
            }
        }, 15000); // 15 seconds max boot time per layer
    }

    private async recoverBoot() {
        // Guard: Do NOT retry if boot already reached a terminal state
        const currentState = this.bootState$.value;
        if (currentState === BootStage.COMPLETE || currentState === BootStage.SAFE_MODE) {
            this.logger.log(`[BootRecovery] Boot already in terminal state (${currentState}). Skipping recovery.`);
            return;
        }

        try {
            switch (this.bootRetryCount) {
                case 1:
                    this.logger.warn('[BootRecovery] Level 1: Forcing LocalDb Reconnect');
                    await this.localDb.forceReconnect();
                    break;
                case 2:
                    this.logger.warn('[BootRecovery] Level 2: Resetting Sync');
                    const syncService = this.injector.get(SyncService);
                    await syncService.reset();
                    break;
                case 3:
                    this.logger.warn('[BootRecovery] Level 3: Vault may require manual unlock. Refreshing auth connection.');
                    break;
            }

            this.bootStarted = false;
            await this.init();
        } catch (e: any) {
            this.logger.error('[BootRecovery] Recovery failed', e);
            this.bootState$.next(BootStage.FAILED);
            this.bootErrorSubject.next({ type: 'BOOT_FAIL', message: e.message });
        }
    }

    async init() {
        // Guard: Block re-entry if boot reached ANY terminal state
        const currentState = this.bootState$.value;
        if (currentState === BootStage.COMPLETE || currentState === BootStage.SAFE_MODE) {
            this.logger.log(`[Boot] Already in terminal state (${currentState}). Skipping duplicate boot.`);
            return;
        }

        if (this.bootStarted) {
            this.logger.log('[Boot] Boot already in progress');
            return;
        }

        // Signal-style boot mutex: prevents concurrent boot execution
        if (this.bootRunning) {
            this.logger.log('[Boot] Boot mutex locked. Rejecting concurrent attempt.');
            return;
        }
        this.bootRunning = true;
        this.bootStarted = true;
        this.startBootWatchdog();

        const startTime = performance.now();
        this.logger.log(`[Boot] Starting sequence...`);

        try {
            // STEP 1 - PLATFORM
            await this.platform.ready();
            this.bootState$.next(BootStage.PLATFORM_READY);
            this.logger.log(`[Boot] PLATFORM READY`);

            // STEP 2 - VAULT
            await this.localDb.initialize();
            await this.localDb.readyPromise;
            this.bootState$.next(BootStage.VAULT_READY);
            this.logger.log(`[Boot] VAULT READY`);

            // STEP 3 - AUTH
            // Promise.race to prevent infinite hangs if auth initialized hangs
            const authPromise = this.auth.initialize();
            const authTimeout = new Promise<void>((_, reject) => {
                setTimeout(() => reject(new Error("AUTH_SERVICE_TIMEOUT")), 10000);
            });
            await Promise.race([authPromise, authTimeout]);
            await this.auth.authReadyPromise;
            this.bootState$.next(BootStage.AUTH_READY);
            this.logger.log(`[Boot] AUTH READY`);

            // STEP 4 - SYNC
            const syncService = this.injector.get(SyncService);
            await syncService.start();
            this.bootState$.next(BootStage.SYNC_READY);
            this.logger.log(`[Boot] SYNC READY`);

            // STEP 5 - REALTIME ENGINES
            await this.initSecondaryServices();
            this.bootState$.next(BootStage.ENGINES_READY);

            const elapsed = performance.now() - startTime;
            this.logger.log(`[Boot] SUCCESS: Completed in ${elapsed.toFixed(0)} ms`);

            // END
            if (this.bootWatchdogTimer) {
                clearTimeout(this.bootWatchdogTimer);
                this.bootWatchdogTimer = null;
            }
            this.bootState$.next(BootStage.COMPLETE);

        } catch (error: any) {
            this.logger.error('[Boot] Initialization failed', error);

            if (error.message === 'BIOMETRIC_FAILED') {
                this.logger.warn("[Boot] Entering SAFE MODE");
                // Clear watchdog before entering terminal state
                if (this.bootWatchdogTimer) {
                    clearTimeout(this.bootWatchdogTimer);
                    this.bootWatchdogTimer = null;
                }
                this.bootState$.next(BootStage.SAFE_MODE);
                return;
            }

            // Only emit FAILED if we are out of retries (watchdog will handle recovery automatically)
            // But we can fast-track the retry here to be more responsive to direct failures.
            if (this.bootRetryCount >= this.MAX_BOOT_RETRIES) {
                this.bootState$.next(BootStage.FAILED);
                this.bootErrorSubject.next({
                    type: error.name === 'TimeoutError' || error.message?.includes('timeout') ? 'BOOT_TIMEOUT' : 'BOOT_FAIL',
                    message: error.message || 'Unknown boot error'
                });
            } else {
                this.logger.warn(`[Boot] Fast-tracking recovery due to explicit error.`);
                this.bootRetryCount++;
                this.recoverBoot();
            }

        } finally {
            this.bootRunning = false; // Release mutex
            try {
                await SplashScreen.hide();
            } catch (e) { }
        }
    }

    private async initSecondaryServices() {
        try {
            await this.localDb.readyPromise;
            await this.auth.authReadyPromise;

            // === DIAGNOSTIC: Isolate each service to find NG0200 source ===
            try {
                this.logger.log('[AppInit][DI-TRACE] → Injector.get(RetrySchedulerService)');
                const retryScheduler = this.injector.get(RetrySchedulerService);
                this.logger.log('[AppInit][DI-TRACE] ✓ RetrySchedulerService OK');
                retryScheduler.start();
            } catch (e: any) {
                this.logger.error('[AppInit][DI-TRACE] ✗ RetrySchedulerService FAILED', e?.message);
            }

            try {
                this.logger.log('[AppInit][DI-TRACE] → Injector.get(MessageAckService)');
                const ackService = this.injector.get(MessageAckService);
                this.logger.log('[AppInit][DI-TRACE] ✓ MessageAckService OK');
                ackService.start();
            } catch (e: any) {
                this.logger.error('[AppInit][DI-TRACE] ✗ MessageAckService FAILED', e?.message);
            }

            try {
                this.logger.log('[AppInit][DI-TRACE] → Injector.get(PushService)');
                const pushService = this.injector.get(PushService);
                this.logger.log('[AppInit][DI-TRACE] ✓ PushService OK');
                pushService.initPush();
            } catch (e: any) {
                this.logger.error('[AppInit][DI-TRACE] ✗ PushService FAILED', e?.message);
            }

            try {
                this.logger.log('[AppInit][DI-TRACE] → Injector.get(CallService)');
                const callService = this.injector.get(CallService);
                this.logger.log('[AppInit][DI-TRACE] ✓ CallService OK');
                callService.init();
                this.logger.log('[AppInit][DI-TRACE] ✓ CallService.init() OK');
            } catch (e: any) {
                this.logger.error('[AppInit][DI-TRACE] ✗ CallService FAILED', e?.message);
            }

            this.logger.log('[AppInit] Reliability engines started.');

            try {
                this.logger.log('[AppInit][DI-TRACE] → Injector.get(ChatService)');
                const chatService = this.injector.get(ChatService);
                this.logger.log('[AppInit][DI-TRACE] ✓ ChatService OK');

                this.logger.log('[AppInit][DI-TRACE] → chatService.lateInit()');
                chatService.lateInit();
                this.logger.log('[AppInit][DI-TRACE] ✓ chatService.lateInit() OK');

                await chatService.syncInbox();
                this.logger.log('[AppInit][DI-TRACE] ✓ chatService.syncInbox() OK');
            } catch (e: any) {
                this.logger.error('[AppInit][DI-TRACE] ✗ ChatService FAILED', e?.message);
            }

        } catch (e) {
            this.logger.warn('[AppInit] Some secondary services failed to init', e);
        }
    }
}
