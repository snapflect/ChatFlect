import { Injectable } from '@angular/core';
import { Network } from '@capacitor/network';
import { StorageService } from './storage.service';
import { ChatService } from './chat.service';
import { ConflictResolverService } from './conflict-resolver.service';
import { LoggingService } from './logging.service';

@Injectable({
    providedIn: 'root'
})
export class SyncService {

    private isSyncing = false;
    private syncInterval: any;

    constructor(
        private storage: StorageService,
        private chatService: ChatService,
        private conflictResolver: ConflictResolverService,
        private logger: LoggingService
    ) {
        this.initNetworkListener();
    }

    private initNetworkListener() {
        Network.addListener('networkStatusChange', status => {
            if (status.connected) {
                this.logger.log('[SyncService][v14] Network restored. Triggering sync...');
                this.processOutbox();
            }
        });

        // Initial Check
        Network.getStatus().then(status => {
            if (status.connected) this.processOutbox();
        });
    }

    /**
     * Process the offline action queue (FIFO).
     * Handles Retries, Backoff, and Conflicts.
     */
    async processOutbox() {
        if (this.isSyncing) return;
        this.isSyncing = true;

        try {
            const queue = await this.storage.getOutbox();
            if (queue.length === 0) return;

            this.logger.log(`[SyncService][v14] Processing queue: ${queue.length} items`);

            for (const item of queue) {
                try {
                    // 1. Attempt Action
                    await this.chatService.retryOfflineAction(item.chat_id, item.action, item.payload);

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
