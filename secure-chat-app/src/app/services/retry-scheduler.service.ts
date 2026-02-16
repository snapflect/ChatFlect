import { Injectable } from '@angular/core';
import { LocalDbService } from './local-db.service';
import { LoggingService } from './logging.service';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { App } from '@capacitor/app';
import { Network } from '@capacitor/network';

/**
 * RetrySchedulerService (v2.3 Reliability Engine)
 * Manages the local_pending_queue with exponential backoff.
 * Ensures "Send it until it works" WhatsApp-style delivery.
 */
@Injectable({
    providedIn: 'root'
})
export class RetrySchedulerService {
    private isPolling = false;
    private readonly BASE_POLL_INTERVAL = 60000; // 60s
    private readonly MAX_POLL_INTERVAL = 600000; // 10m
    private currentPollInterval = 60000;
    private idleCounter = 0;

    private readonly BACKOFF_STRATEGY = [30000, 120000, 600000, 3600000]; // 30s, 2m, 10m, 1h
    private readonly MAX_RETRIES = 5;

    constructor(
        private localDb: LocalDbService,
        private logger: LoggingService,
        private http: HttpClient
    ) {
        this.initLifecycle();
    }

    private initLifecycle() {
        App.addListener('appStateChange', ({ isActive }) => {
            if (isActive) {
                this.logger.log('[RetryScheduler] App foregrounded. Resetting poll speed.');
                this.resetPollSpeed();
            } else {
                this.logger.log('[RetryScheduler] App backgrounded. Triggering Flush Mode...');
                this.flush();
            }
        });
    }

    /**
     * Start background polling for pending messages
     */
    start() {
        if (this.isPolling) return;
        this.isPolling = true;
        this.resetPollSpeed();
        this.poll();
    }

    private async poll() {
        if (!this.isPolling) return;

        try {
            const hasWork = await this.processQueue();

            if (hasWork) {
                this.idleCounter = 0;
            } else {
                this.idleCounter++;
            }

            // Adaptive interval: increase by 1.5x each idle cycle
            this.currentPollInterval = Math.min(
                this.BASE_POLL_INTERVAL * Math.pow(1.5, Math.min(this.idleCounter, 6)),
                this.MAX_POLL_INTERVAL
            );

        } catch (err) {
            this.logger.error('[RetryScheduler] Poll Error', err);
        }

        setTimeout(() => this.poll(), this.currentPollInterval);
    }

    /**
     * Reset the poll interval to base speed
     */
    resetPollSpeed() {
        this.idleCounter = 0;
        this.currentPollInterval = this.BASE_POLL_INTERVAL;
    }

    /**
     * Process all messages ready for retry
     * @returns boolean true if messages were processed
     */
    async processQueue(): Promise<boolean> {
        const now = Date.now();
        const pending = await this.localDb.query(`
            SELECT Q.*, M.payload, M.chat_id, M.type 
            FROM local_pending_queue Q
            JOIN local_messages M ON Q.message_id = M.id
            WHERE Q.next_retry_at <= ? AND Q.retry_count < ?
            ORDER BY Q.created_at ASC
        `, [now, this.MAX_RETRIES]);

        if (pending.length === 0) return false;

        this.logger.log(`[RetryScheduler] Attempting retry for ${pending.length} messages...`);

        for (const item of pending) {
            await this.attemptSend(item);
        }
        return true;
    }

    private async attemptSend(item: any): Promise<void> {
        try {
            // v2.3 Sync Logic: Send to PHP backend
            // In a real implementation, this would call ChatService.sendInternal
            // For now, we simulate the network call to the send.php endpoint

            const response: any = await this.http.post(`${environment.apiUrl}/v4/messages/send.php`, {
                client_id: item.message_id, // v4 expectations
                chat_id: item.chat_id,
                payload: item.payload,
                type: item.type,
                sender_device_uuid: localStorage.getItem('device_uuid') // HF-5D.3: Ownership Proof
            }).toPromise();

            if (response && response.success === true) {
                await this.onSuccess(item.message_id, response.server_id, response.server_timestamp);
            } else {
                throw new Error(response?.message || 'Server rejected message');
            }

        } catch (err: any) {
            await this.onFailure(item, err.message || 'Network Error');
        }
    }

    private async onSuccess(messageId: string, serverId: number, serverTs: number): Promise<void> {
        this.logger.log(`[RetryScheduler] Success for ${messageId}`);

        // 1. Update message status
        await this.localDb.run(`
            UPDATE local_messages 
            SET status = 'sent', server_id = ?, server_timestamp = ? 
            WHERE id = ?
        `, [serverId, serverTs, messageId]);

        // 2. Remove from queue
        await this.localDb.run('DELETE FROM local_pending_queue WHERE message_id = ?', [messageId]);
    }

    private async onFailure(item: any, error: string): Promise<void> {
        const newRetryCount = item.retry_count + 1;
        const nextDelay = this.BACKOFF_STRATEGY[Math.min(newRetryCount - 1, this.BACKOFF_STRATEGY.length - 1)];
        const nextRetryAt = Date.now() + nextDelay;

        this.logger.warn(`[RetryScheduler] Failure for ${item.message_id} (Attempt ${newRetryCount}). Next retry at: ${new Date(nextRetryAt).toLocaleTimeString()}`);

        await this.localDb.run(`
            UPDATE local_pending_queue 
            SET retry_count = ?, next_retry_at = ?, last_error = ? 
            WHERE queue_id = ?
        `, [newRetryCount, nextRetryAt, error, item.queue_id]);
    }

    /**
     * HF-2.3A: Background Flush Mode
     * Aggressively process all pending messages regardless of backoff timer.
     */
    async flush(): Promise<void> {
        const status = await Network.getStatus();
        if (!status.connected) {
            this.logger.log('[RetryScheduler] Flush skipped: Device offline.');
            return;
        }

        // Limit background execution to prevent OS battery penalty (HF-2.3D)
        const timeout = setTimeout(() => {
            this.logger.warn('[RetryScheduler] Flush timed out (20s safeguard).');
        }, 20000);

        try {
            const pending = await this.localDb.query(`
                SELECT Q.*, M.payload, M.chat_id, M.type 
                FROM local_pending_queue Q
                JOIN local_messages M ON Q.message_id = M.id
                WHERE Q.retry_count < ?
                ORDER BY Q.created_at ASC
            `, [this.MAX_RETRIES]);

            for (const item of pending) {
                await this.attemptSend(item);
            }
        } finally {
            clearTimeout(timeout);
        }
    }

    /**
     * Add a message to the queue manually (e.g. after initial send failure)
     */
    async addToQueue(messageId: string): Promise<void> {
        await this.localDb.run(`
            INSERT OR IGNORE INTO local_pending_queue (message_id) VALUES (?)
        `, [messageId]);

        // Reset speed to ensure quick processing of the new message
        this.resetPollSpeed();
    }
}
