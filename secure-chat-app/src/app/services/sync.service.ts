import { Injectable, Injector } from '@angular/core';
import { PluginListenerHandle } from '@capacitor/core';
import { Network } from '@capacitor/network';
import { StorageService } from './storage.service';
import { ChatService } from './chat.service';
import { ConflictResolverService } from './conflict-resolver.service';
import { LoggingService } from './logging.service';
import { LocalDbService } from './local-db.service';
import { AuthService } from './auth.service';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

@Injectable({
    providedIn: 'root'
})
export class SyncService {

    private isSyncing = false;
    private startPromise: Promise<void> | null = null;
    private networkListenerInitialized = false;
    private networkListener?: PluginListenerHandle;
    private triggerSync$ = new Subject<void>();

    // Lazy AuthService to break DI cycle (Signal-style boot fix)
    private _authService: AuthService | null = null;
    private get authService(): AuthService {
        if (!this._authService) this._authService = this.injector.get(AuthService);
        return this._authService;
    }

    constructor(
        private storage: StorageService,
        private conflictResolver: ConflictResolverService,
        private logger: LoggingService,
        private localDb: LocalDbService,
        private injector: Injector
    ) {
        // HF-14.2: Debounce network rapid-fire spam
        this.triggerSync$.pipe(debounceTime(3000)).subscribe(() => {
            this.processOutbox();
        });

        // HF-14.4: Listen to Auth Logout safely via orchestrator
        // Deferred to avoid Injector.get(AuthService) during construction
        setTimeout(() => {
            this.authService.logout$.subscribe(() => {
                this.logger.log('[SyncService] Auth logout detected. Resetting state.');
                this.reset();
            });
        }, 0);
    }



    /**
     * HF-14.3: Standard Lifecycle Start
     * Ensures background processes only begin once security layers are unlocked.
     */
    start(): Promise<void> {
        if (this.startPromise) {
            this.logger.log('[SyncService] Initialization already in progress or completed. Skipping.');
            return this.startPromise;
        }

        this.startPromise = this.performStart();
        return this.startPromise;
    }

    private async performStart(): Promise<void> {
        this.logger.log('[SyncService] Waiting for security layers...');

        // Block until vault is ready and auth is initialized
        await this.localDb.readyPromise;
        await this.authService.authReadyPromise;

        this.logger.log('[SyncService] Security layers READY. Initializing Sync lifecycle.');

        await this.initNetworkListener();

        // Initial Check
        const status = await Network.getStatus();
        if (status.connected) {
            this.triggerSync$.next();
        }
    }

    private async initNetworkListener() {
        if (this.networkListenerInitialized) {
            return;
        }
        this.networkListenerInitialized = true;

        this.networkListener = await Network.addListener('networkStatusChange', status => {
            if (status.connected) {
                this.logger.log('[SyncService][v14] Network restored. Debouncing sync...');
                this.triggerSync$.next();
            }
        });
    }

    /**
     * Clear the start promise so the service can boot again after logout.
     * Also removes any active network listeners.
     */
    async reset() {
        this.startPromise = null;
        this.networkListenerInitialized = false; // Reset listener flag just in case

        if (this.networkListener) {
            await this.networkListener.remove();
            this.networkListener = undefined;
        }
    }

    /**
     * Public method to allow manual triggering of the sync queue
     * (e.g. immediately after a user sends a message instead of waiting for network bounce)
     */
    public triggerSync() {
        this.logger.log('[SyncService] Manual queue flush triggered');
        this.triggerSync$.next();
    }

    /**
     * Process the offline action queue (FIFO).
     * Handles Retries, Backoff, and Conflicts.
     */
    async processOutbox() {
        if (this.isSyncing) return;
        this.isSyncing = true;

        // HF-Race Fix: Wait for Vault Unlock AND Auth Readiness
        await this.localDb.readyPromise;
        await this.authService.authReadyPromise;

        try {
            const queue = await this.storage.getOutbox();
            if (queue.length === 0) return;

            this.logger.log(`[SyncService][v14] Processing queue: ${queue.length} items`);

            // Resolve ChatService outside loop to prevent repeated DI
            const chatService = this.injector.get(ChatService);

            for (const item of queue) {
                try {
                    // 1. Attempt Action (HF-8.36: Lazy Load ChatService)
                    await chatService.retryOfflineAction(item.chat_id, item.action, item.payload);


                    // 2. Success -> Remove
                    await this.storage.removeFromOutbox(item.id);

                } catch (err: any) {
                    // 3. Error Handling
                    this.logger.error(`[SyncService] Action ${item.id} failed`, err);

                    // Detect Conflict (409)
                    if (err.status === 409 || err.message?.includes('Conflict')) {
                        const resolution = await this.conflictResolver.resolve(item.id, err);
                        if (resolution === 'keep_remote') {
                            await this.storage.removeFromOutbox(item.id); // Discard local
                        } else if (resolution === 'retry') {
                            await this.storage.incrementOutboxRetry(item.id);
                        }
                    } else {
                        // Standard Retry (Backoff logic)
                        this.logger.warn("OUTBOX_FLUSH_RETRY", { id: item.id, error: err.message });
                        await this.storage.incrementOutboxRetry(item.id);

                        // Exponential backoff logic based on item's retry count
                        const retries = item.retry_count || 1;
                        const backoffSeconds = Math.min(30, Math.pow(2, retries));

                        this.logger.log(`[SyncService] Applying backoff of ${backoffSeconds}s for item ${item.id}`);
                        await new Promise(resolve => setTimeout(resolve, backoffSeconds * 1000));

                        // Break queue processing on generic error to preserve order
                        break;
                    }
                }
            }
        } finally {
            this.isSyncing = false;
        }
    }
}
