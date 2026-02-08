import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface GroupInfo {
    group_id: string;
    title: string;
    role: string;
    member_count: number;
    updated_at: string;
}

export interface GroupMember {
    user_id: string;
    role: string;
    joined_at: string;
}

export interface GroupDetail {
    group: {
        group_id: string;
        title: string;
        created_by: string;
        created_at: string;
        updated_at: string;
    };
    members: GroupMember[];
    my_role: string;
}

@Injectable({
    providedIn: 'root'
})
export class GroupService {
    private baseUrl = environment.relayApiUrl || '/api/v4/groups';

    constructor(private http: HttpClient) { }

    createGroup(title: string, members: string[]): Observable<{ success: boolean; group_id: string }> {
        return this.http.post<{ success: boolean; group_id: string }>(
            `${this.baseUrl}/create.php`,
            { title, members }
        );
    }

    listGroups(): Observable<{ success: boolean; groups: GroupInfo[] }> {
        return this.http.get<{ success: boolean; groups: GroupInfo[] }>(
            `${this.baseUrl}/list.php`
        );
    }

    getGroupDetail(groupId: string): Observable<{ success: boolean } & GroupDetail> {
        return this.http.get<{ success: boolean } & GroupDetail>(
            `${this.baseUrl}/detail.php`,
            { params: { group_id: groupId } }
        );
    }
}
