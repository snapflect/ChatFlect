import { Injectable } from '@angular/core';
import { LocalDbService } from './local-db.service';
import { LoggingService } from './logging.service';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { App } from '@capacitor/app';
import { Network } from '@capacitor/network';

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
    private readonly BASE_POLL_INTERVAL = 45000; // 45s
    private readonly MAX_POLL_INTERVAL = 600000; // 10m
    private currentPollInterval = 45000;
    private idleCounter = 0;

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
                this.logger.log('[MessageAck] App foregrounded. Resetting poll speed.');
                this.resetPollSpeed();
            } else {
                this.logger.log('[MessageAck] App backgrounded. Flushing receipts...');
                this.flush();
            }
        });
    }

    start() {
        if (this.isPolling) return;
        this.isPolling = true;
        this.resetPollSpeed();
        this.poll();
    }

    private async poll() {
        if (!this.isPolling) return;

        try {
            const hasWork = await this.syncReceipts();

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
            this.logger.error('[MessageAck] Receipt Sync Error', err);
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
     * Pull new receipts from the server
     * @returns boolean true if receipts were found
     */
    async syncReceipts(): Promise<boolean> {
        const net = await Network.getStatus();
        if (!net.connected) return false;

        try {
            const response: any = await this.http.get(`${environment.apiUrl}/receipts/pull.php`).toPromise();

            if (response && response.status === 'success' && Array.isArray(response.receipts)) {
                if (response.receipts.length === 0) return false;

                for (const receipt of response.receipts) {
                    await this.processReceipt(receipt);
                }
                return true;
            }
            return false;
        } catch (err) {
            this.logger.warn('[MessageAck] Failed to pull receipts', err);
            return false;
        }
    }

    /**
     * HF-2.3A: Background Flush Mode
     */
    async flush(): Promise<void> {
        // Simple flush: trigger sync once.
        await this.syncReceipts();
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
                status: 'read'
            }]
        };

        this.http.post(`${environment.apiUrl}/v4/messages/ack.php`, pkg).toPromise().catch(err => {
            this.logger.warn('[MessageAck] Read Receipt Failed', err);
        });
    }
}
