import { Injectable } from '@angular/core';
import { GroupMessage } from '../group-relay.service';
import { BehaviorSubject } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class GroupOrderingService {
    private groupMessages = new Map<string, BehaviorSubject<GroupMessage[]>>();

    ingestMessages(groupId: string, newMessages: GroupMessage[]) {
        if (!this.groupMessages.has(groupId)) {
            this.groupMessages.set(groupId, new BehaviorSubject<GroupMessage[]>([]));
        }

        const subject = this.groupMessages.get(groupId);
        const split = subject.getValue();

        // Merge & Deduplicate
        const map = new Map<string, GroupMessage>();
        [...split, ...newMessages].forEach(m => map.set(m.message_uuid, m));

        const merged = Array.from(map.values());

        // Deterministic Sort: Server Seq > Created At
        merged.sort((a, b) => {
            if (a.server_seq !== b.server_seq) {
                return a.server_seq - b.server_seq;
            }
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });

        // Gap Detection Trigger (Logic Placeholder)
        this.checkForGaps(groupId, merged);

        subject.next(merged);
    }

    getMessages(groupId: string) {
        if (!this.groupMessages.has(groupId)) {
            this.groupMessages.set(groupId, new BehaviorSubject<GroupMessage[]>([]));
        }
        return this.groupMessages.get(groupId).asObservable();
    }

    private checkForGaps(groupId: string, sortedMessages: GroupMessage[]) {
        // Check strict server_seq monotonicity
        // Trigger repair service if gap found (Circular dependency handling required in real app)
    }
}
