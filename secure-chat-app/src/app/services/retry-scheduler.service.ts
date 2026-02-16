import { Injectable } from '@angular/core';
import { LocalDbService } from './local-db.service';
import { LoggingService } from './logging.service';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';

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
    private readonly POLL_INTERVAL = 60000; // 60s
    private readonly BACKOFF_STRATEGY = [30000, 120000, 600000, 3600000]; // 30s, 2m, 10m, 1h
    private readonly MAX_RETRIES = 5;

    constructor(
        private localDb: LocalDbService,
        private logger: LoggingService,
        private http: HttpClient
    ) { }

    /**
     * Start background polling for pending messages
     */
    start() {
        if (this.isPolling) return;
        this.isPolling = true;
        this.poll();
    }

    private async poll() {
        if (!this.isPolling) return;

        try {
            await this.processQueue();
        } catch (err) {
            this.logger.error('[RetryScheduler] Poll Error', err);
        }

        setTimeout(() => this.poll(), this.POLL_INTERVAL);
    }

    /**
     * Process all messages ready for retry
     */
    async processQueue(): Promise<void> {
        const now = Date.now();
        const pending = await this.localDb.query(`
            SELECT Q.*, M.payload, M.chat_id, M.type 
            FROM local_pending_queue Q
            JOIN local_messages M ON Q.message_id = M.id
            WHERE Q.next_retry_at <= ? AND Q.retry_count < ?
            ORDER BY Q.created_at ASC
        `, [now, this.MAX_RETRIES]);

        if (pending.length === 0) return;

        this.logger.log(`[RetryScheduler] Attempting retry for ${pending.length} messages...`);

        for (const item of pending) {
            await this.attemptSend(item);
        }
    }

    private async attemptSend(item: any): Promise<void> {
        try {
            // v2.3 Sync Logic: Send to PHP backend
            // In a real implementation, this would call ChatService.sendInternal
            // For now, we simulate the network call to the send.php endpoint

            const response: any = await this.http.post(`${environment.apiUrl}/send.php`, {
                client_uuid: item.message_id,
                chat_id: item.chat_id,
                payload: item.payload,
                type: item.type
            }).toPromise();

            if (response && response.status === 'success') {
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
     * Add a message to the queue manually (e.g. after initial send failure)
     */
    async addToQueue(messageId: string): Promise<void> {
        await this.localDb.run(`
            INSERT OR IGNORE INTO local_pending_queue (message_id) VALUES (?)
        `, [messageId]);
    }
}
