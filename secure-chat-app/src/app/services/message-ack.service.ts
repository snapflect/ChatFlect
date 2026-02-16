import { Injectable } from '@angular/core';
import { LocalDbService } from './local-db.service';
import { LoggingService } from './logging.service';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';

/**
 * MessageAckService (v2.3 Reliability Engine)
 * Manages the "Ticks" system: sent -> delivered -> read.
 * Pulls receipts from server and updates local_messages + local_receipts.
 */
@Injectable({
    providedIn: 'root'
})
export class MessageAckService {
    private isPolling = false;
    private readonly POLL_INTERVAL = 45000; // 45s (slightly faster than retry)

    constructor(
        private localDb: LocalDbService,
        private logger: LoggingService,
        private http: HttpClient
    ) { }

    start() {
        if (this.isPolling) return;
        this.isPolling = true;
        this.poll();
    }

    private async poll() {
        if (!this.isPolling) return;

        try {
            await this.syncReceipts();
        } catch (err) {
            this.logger.error('[MessageAck] Receipt Sync Error', err);
        }

        setTimeout(() => this.poll(), this.POLL_INTERVAL);
    }

    /**
     * Pull new receipts from the server
     */
    async syncReceipts(): Promise<void> {
        // Optimization: Only pull receipts for messages that aren't 'read' yet
        // In a real implementation, we'd use a 'last_receipt_sync_id'

        try {
            const response: any = await this.http.get(`${environment.apiUrl}/receipts/pull.php`).toPromise();

            if (response && response.status === 'success' && Array.isArray(response.receipts)) {
                for (const receipt of response.receipts) {
                    await this.processReceipt(receipt);
                }
            }
        } catch (err) {
            this.logger.warn('[MessageAck] Failed to pull receipts', err);
        }
    }

    private async processReceipt(receipt: any): Promise<void> {
        // receipt: { message_uuid, user_id, status, timestamp }

        // 1. Log receipt in local_receipts table
        await this.localDb.run(`
            INSERT OR IGNORE INTO local_receipts (message_id, user_id, status, timestamp)
            VALUES (?, ?, ?, ?)
        `, [receipt.message_uuid, receipt.user_id, receipt.status, receipt.timestamp]);

        // 2. Update status in local_messages if this receipt is "higher" than current
        // Order: read > delivered > sent > pending
        const statusPriority: any = { 'pending': 0, 'sent': 1, 'delivered': 2, 'read': 3 };

        const msg = await this.localDb.query('SELECT status FROM local_messages WHERE id = ?', [receipt.message_uuid]);
        if (msg.length > 0) {
            const currentStatus = msg[0].status;
            if (statusPriority[receipt.status] > statusPriority[currentStatus]) {
                await this.localDb.run('UPDATE local_messages SET status = ? WHERE id = ?', [receipt.status, receipt.message_uuid]);
                this.logger.log(`[MessageAck] Message ${receipt.message_uuid} status updated to ${receipt.status}`);
            }
        }
    }

    /**
     * Mark a received message as 'read' locally and notify server
     */
    async markAsRead(messageId: string): Promise<void> {
        await this.localDb.run("UPDATE local_messages SET status = 'read' WHERE id = ?", [messageId]);

        // HF-Extra: Standardized ACK Sync
        const pkg = {
            acks: [{
                message_uuid: messageId,
                status: 'READ'
            }]
        };

        this.http.post(`${environment.apiUrl}/v4/messages/ack.php`, pkg).toPromise().catch(err => {
            this.logger.warn('[MessageAck] Read Receipt Failed', err);
        });
    }
}
