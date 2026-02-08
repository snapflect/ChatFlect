import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface GroupReceipt {
    receipt_id: number;
    message_uuid: string;
    user_id: string; // Who read it
    type: 'DELIVERED' | 'READ';
    created_at: string;
}

@Injectable({
    providedIn: 'root'
})
export class GroupReceiptService {
    // Map<GroupId, Map<MessageUUID, Receipt[]>>
    private receiptStore = new Map<string, Map<string, GroupReceipt[]>>();
    public receiptsUpdates = new BehaviorSubject<string>(null); // Trigger for UI

    ingestReceipts(groupId: string, newReceipts: GroupReceipt[]) {
        if (!this.receiptStore.has(groupId)) {
            this.receiptStore.set(groupId, new Map());
        }

        const groupStore = this.receiptStore.get(groupId);

        newReceipts.forEach(r => {
            if (!groupStore.has(r.message_uuid)) {
                groupStore.set(r.message_uuid, []);
            }
            // Idempotent merge could happen here (check if user already has receipt type)
            groupStore.get(r.message_uuid).push(r);
        });

        this.receiptsUpdates.next(groupId);
    }

    getMessageReceipts(groupId: string, messageUuid: string): GroupReceipt[] {
        return this.receiptStore.get(groupId)?.get(messageUuid) || [];
    }
}
