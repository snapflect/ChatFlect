import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class GroupAdminService {
    private baseUrl = environment.relayApiUrl || '/api/v4/groups';

    constructor(private http: HttpClient) { }

    addMember(groupId: string, userId: string): Observable<{ success: boolean; message?: string }> {
        return this.http.post<{ success: boolean; message?: string }>(
            `${this.baseUrl}/add_member.php`,
            { group_id: groupId, user_id: userId }
        );
    }

    removeMember(groupId: string, userId: string): Observable<{ success: boolean }> {
        return this.http.post<{ success: boolean }>(
            `${this.baseUrl}/remove_member.php`,
            { group_id: groupId, user_id: userId }
        );
    }

    promoteAdmin(groupId: string, userId: string): Observable<{ success: boolean }> {
        return this.http.post<{ success: boolean }>(
            `${this.baseUrl}/promote_admin.php`,
            { group_id: groupId, user_id: userId }
        );
    }

    demoteAdmin(groupId: string, userId: string): Observable<{ success: boolean }> {
        return this.http.post<{ success: boolean }>(
            `${this.baseUrl}/demote_admin.php`,
            { group_id: groupId, user_id: userId }
        );
    }

    updateTitle(groupId: string, title: string): Observable<{ success: boolean }> {
        return this.http.post<{ success: boolean }>(
            `${this.baseUrl}/update_title.php`,
            { group_id: groupId, title }
        );
    }

    leaveGroup(groupId: string): Observable<{ success: boolean }> {
        return this.http.post<{ success: boolean }>(
            `${this.baseUrl}/leave.php`,
            { group_id: groupId }
        );
    }
}
