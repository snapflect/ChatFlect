import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { GroupRelayService, GroupMessage } from './group-relay.service';
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { v7 as uuidv7 } from 'uuid';

interface GroupOutboxDB extends DBSchema {
    outbox: {
        key: string;
        value: {
            message_uuid: string;
            group_id: string;
            encrypted_payload: string;
            created_at: number;
            retry_count: number;
        };
    };
}

@Injectable({
    providedIn: 'root'
})
export class GroupOutboxService {
    private dbPromise: Promise<IDBPDatabase<GroupOutboxDB>>;
    private isOfflineSubject = new BehaviorSubject<boolean>(!navigator.onLine);

    constructor(private groupRelay: GroupRelayService) {
        this.dbPromise = openDB<GroupOutboxDB>('group-outbox-db', 1, {
            upgrade(db) {
                db.createObjectStore('outbox', { keyPath: 'message_uuid' });
            },
        });

        window.addEventListener('online', () => this.flushOutbox());
        window.addEventListener('offline', () => this.isOfflineSubject.next(true));
    }

    async queueMessage(groupId: string, encryptedPayload: string): Promise<string> {
        const messageUuid = uuidv7();
        const db = await this.dbPromise;

        await db.put('outbox', {
            message_uuid: messageUuid,
            group_id: groupId,
            encrypted_payload: encryptedPayload,
            created_at: Date.now(),
            retry_count: 0
        });

        if (navigator.onLine) {
            this.flushOutbox();
        }

        return messageUuid;
    }

    private async flushOutbox() {
        this.isOfflineSubject.next(false);
        const db = await this.dbPromise;
        const pending = await db.getAll('outbox');

        // Sort by creation time to ensure strict ordering
        pending.sort((a, b) => a.created_at - b.created_at);

        for (const msg of pending) {
            try {
                await this.groupRelay.sendGroupMessage(
                    msg.group_id,
                    msg.encrypted_payload,
                    msg.message_uuid
                ).toPromise();

                await db.delete('outbox', msg.message_uuid);
            } catch (e) {
                console.error('Failed to flush group message', e);
                // Implement exponential backoff here if needed, or leave for next online event
            }
        }
    }
}
