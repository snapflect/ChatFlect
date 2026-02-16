import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface RecipientKey {
    recipient_id: string;
    device_uuid: string;
    encrypted_key: string;
}

export interface SenderKeyBundle {
    sender_id: string;
    sender_device_uuid: string;
    sender_key_id: number;
    encrypted_sender_key: string;
    created_at: string;
}

@Injectable({
    providedIn: 'root'
})
export class GroupSignalService {
    private baseUrl = environment.relayApiUrl || '/relay';

    constructor(private http: HttpClient) { }

    uploadSenderKey(
        groupId: string,
        senderKeyId: number,
        recipientKeys: RecipientKey[],
        bundleVersion: number // HF-5B.2
    ): Observable<{ success: boolean; count: number }> {
        return this.http.post<{ success: boolean; count: number }>(
            `${this.baseUrl}/upload_sender_key.php`,
            {
                group_id: groupId,
                sender_key_id: senderKeyId,
                recipient_keys: recipientKeys,
                bundle_version: bundleVersion
            }
        );
    }

    fetchSenderKeys(groupId: string): Observable<{ success: boolean; keys: SenderKeyBundle[] }> {
        return this.http.get<{ success: boolean; keys: SenderKeyBundle[] }>(
            `${this.baseUrl}/fetch_sender_keys.php`,
            { params: { group_id: groupId } }
        );
    }
}
