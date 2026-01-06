import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';

@Injectable({
    providedIn: 'root'
})
export class ApiService {
    constructor(private http: HttpClient) { }

    post(endpoint: string, data: any) {
        return this.http.post(`${environment.apiUrl}/${endpoint}`, data);
    }

    get(endpoint: string) {
        return this.http.get(`${environment.apiUrl}/${endpoint}`);
    }

    getBlob(url: string) {
        // Handle full URL or relative
        const fullUrl = url.startsWith('http') ? url : `${environment.apiUrl}/${url}`;
        return this.http.get(fullUrl, { responseType: 'blob' });
    }
}
