import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface GroupMessage {
    message_uuid: string;
    sender_id: string;
    sender_device_uuid: string;
    server_seq: number;
    encrypted_payload: string;
    created_at: string;
}

export interface SendGroupResponse {
    success: boolean;
    duplicate?: boolean;
    group_id: string;
    message_uuid: string;
    server_seq: number;
    server_received_at: string;
}

export interface PullGroupResponse {
    success: boolean;
    group_id: string;
    messages: GroupMessage[];
    last_seq: number;
    has_more: boolean;
    count: number;
}

@Injectable({
    providedIn: 'root'
})
export class GroupRelayService {
    private baseUrl = environment.relayApiUrl || '/relay';

    constructor(private http: HttpClient) { }

    sendGroupMessage(
        groupId: string,
        encryptedPayload: string,
        messageUuid: string
    ): Observable<SendGroupResponse> {
        return this.http.post<SendGroupResponse>(
            `${this.baseUrl}/send_group.php`,
            { group_id: groupId, encrypted_payload: encryptedPayload, message_uuid: messageUuid }
        );
    }

    pullGroupMessages(
        groupId: string,
        sinceSeq: number = 0,
        limit: number = 50
    ): Observable<PullGroupResponse> {
        return this.http.get<PullGroupResponse>(
            `${this.baseUrl}/pull_group.php`,
            { params: { group_id: groupId, since_seq: sinceSeq.toString(), limit: limit.toString() } }
        );
    }

    repairGroupMessages(
        groupId: string,
        startSeq: number,
        endSeq: number
    ): Observable<PullGroupResponse> {
        return this.http.get<PullGroupResponse>(
            `${this.baseUrl}/repair_group.php`,
            { params: { group_id: groupId, start_seq: startSeq.toString(), end_seq: endSeq.toString() } }
        );
    }
}
