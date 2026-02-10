import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

export interface RelayMessage {
    id: number;
    message_uuid: string;
    sender_id: string;
    server_seq: number;
    encrypted_payload: string;
    created_at: string;
    server_received_at: string;
}

export interface RelayPullResponse {
    messages: RelayMessage[];
    count: number;
    since_seq: number;
}

export interface RelaySendResponse {
    success: boolean;
    server_seq: number;
    timestamp: string;
    duplicate?: boolean;
}

@Injectable({
    providedIn: 'root'
})
export class RelayService {

    constructor(private api: ApiService) { }

    /**
     * Sends an encrypted message via the Relay Backend.
     * @param chatId The chat ID.
     * @param encryptedPayload The encrypted content.
     * @param messageUuid The unique message ID (UUIDv7).
     */
    sendMessage(chatId: string, encryptedPayload: string, messageUuid: string): Observable<RelaySendResponse> {
        return this.api.post('relay/send.php', {
            chat_id: chatId,
            encrypted_payload: encryptedPayload,
            message_uuid: messageUuid
        }).pipe(
            map(res => res as RelaySendResponse)
        );
    }

    /**
     * Fetches messages from the Relay Backend since a specific sequence number.
     * @param chatId The chat ID.
     * @param sinceSeq The last known server sequence number (exclusive).
     * @param limit Maximum number of messages to fetch (default 50).
     */
    fetchMessages(chatId: string, sinceSeq: number = 0, limit: number = 50): Observable<RelayPullResponse> {
        // Construct query params manually or update ApiService to handle params object.
        // ApiService.get takes a string endpoint.
        const params = `chat_id=${encodeURIComponent(chatId)}&since_seq=${sinceSeq}&limit=${limit}`;
        return this.api.get(`relay/pull.php?${params}`).pipe(
            map(res => res as RelayPullResponse)
        );
    }
}
