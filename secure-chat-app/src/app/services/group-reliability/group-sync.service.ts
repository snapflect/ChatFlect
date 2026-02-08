import { Injectable } from '@angular/core';
import { GroupRelayService } from '../group-relay.service';
import { GroupOrderingService } from './group-ordering.service';
import { GroupReceiptService } from './group-receipt.service';

@Injectable({
    providedIn: 'root'
})
export class GroupSyncService {
    private pollIntervalMs = 2000;
    private syncState: Map<string, { lastSeq: number, lastReceiptId: number }> = new Map();

    constructor(
        private relay: GroupRelayService,
        private ordering: GroupOrderingService,
        private receipts: GroupReceiptService
    ) { }

    startSync(groupId: string) {
        if (!this.syncState.has(groupId)) {
            this.syncState.set(groupId, { lastSeq: 0, lastReceiptId: 0 });
        }

        // Simple polling loop (replace with specific logic or websocket trigger later)
        setInterval(() => this.pollGroup(groupId), this.pollIntervalMs);
    }

    private async pollGroup(groupId: string) {
        const state = this.syncState.get(groupId);
        if (!state) return;

        try {
            const response = await this.relay.pullGroupMessages(
                groupId,
                state.lastSeq,
                50 // limit
            ).toPromise();

            if (response && response.success) {
                // Process Messages
                if (response.messages.length > 0) {
                    this.ordering.ingestMessages(groupId, response.messages);
                    state.lastSeq = response.last_seq;
                }

                // Process Receipts
                // Note: pullGroup interface in 'group-relay.service.ts' needs update to support receipts
                // Assuming response structure updated or handled via `any` for now
                const receipts = (response as any).receipts || [];
                if (receipts.length > 0) {
                    this.receipts.ingestReceipts(groupId, receipts);
                    state.lastReceiptId = (response as any).last_receipt_id;
                }

                this.syncState.set(groupId, state);
            }
        } catch (e) {
            console.error('Group sync failed', e);
        }
    }
}
