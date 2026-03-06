import { Injectable, Injector } from '@angular/core';

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
    private syncInterval: any;
    private triggerSync$ = new Subject<void>();

    private _auth: any = null;

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
    }

    private get authService(): any {
        if (!this._auth) {
            // Using require to ensure the file is loaded only once and type is preserved
            const { AuthService } = require('./auth.service');
            this._auth = this.injector.get(AuthService);
        }
        return this._auth;
    }

    /**
     * HF-14.3: Standard Lifecycle Start
     * Ensures background processes only begin once security layers are unlocked.
     */
    async start() {
        this.logger.log('[SyncService] Waiting for security layers...');

        // Block until vault is ready and auth is initialized
        await this.localDb.readyPromise;
        await this.authService.authReadyPromise;

        this.logger.log('[SyncService] Security layers READY. Initializing Sync lifecycle.');

        this.initNetworkListener();

        // Initial Check
        const status = await Network.getStatus();
        if (status.connected) {
            this.triggerSync$.next();
        }
    }

    private initNetworkListener() {
        Network.addListener('networkStatusChange', status => {
            if (status.connected) {
                this.logger.log('[SyncService][v14] Network restored. Debouncing sync...');
                this.triggerSync$.next();
            }
        });
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

            for (const item of queue) {
                try {
                    // 1. Attempt Action (HF-8.36: Lazy Load ChatService)
                    const chatService = this.injector.get(ChatService);
                    await chatService.retryOfflineAction(item.chat_id, item.action, item.payload);


                    // 2. Success -> Remove
                    await this.storage.removeFromOutbox(item.id);

                } catch (err: any) {
                    // 3. Error Handling
                    console.error(`[SyncService] Action ${item.id} failed:`, err);

                    // Detect Conflict (409)
                    if (err.status === 409 || err.message?.includes('Conflict')) {
                        const resolution = await this.conflictResolver.resolve(item.id, err);
                        if (resolution === 'keep_remote') {
                            await this.storage.removeFromOutbox(item.id); // Discard local
                        } else if (resolution === 'retry') {
                            // Logic to "Force" or just retry? For now, we leave in queue to retry naturally
                            // Ideally, we'd update the payload to 'force=true' if API supported it
                            // or we just re-run loop
                            // V14 Scope: Just retry (maybe next loop)
                            await this.storage.incrementOutboxRetry(item.id);
                        }
                    } else {
                        // Standard Retry (Backoff logic could go here)
                        this.logger.warn("OUTBOX_FLUSH_RETRY", { id: item.id, error: err.message });
                        await this.storage.incrementOutboxRetry(item.id);
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
