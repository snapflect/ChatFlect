import { Injectable } from '@angular/core';
import { GroupRelayService } from '../group-relay.service';
import { GroupOrderingService } from './group-ordering.service';

@Injectable({
    providedIn: 'root'
})
export class GroupRepairService {
    constructor(
        private relay: GroupRelayService,
        private ordering: GroupOrderingService
    ) { }

    async repairGap(groupId: string, startSeq: number, endSeq: number) {
        if (endSeq - startSeq > 500) {
            console.warn('Gap too large to repair automatically');
            return;
        }

        try {
            const response = await this.relay.repairGroupMessages(groupId, startSeq, endSeq).toPromise();
            if (response.success && response.messages.length > 0) {
                this.ordering.ingestMessages(groupId, response.messages);
            }
        } catch (e) {
            console.error('Group repair failed', e);
        }
    }
}
