import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';

@Injectable({
    providedIn: 'root'
})
export class ApiService {
    constructor(private http: HttpClient) { }

    post(endpoint: string, data: any, reportProgress: boolean = false) {
        const options: any = {
            reportProgress: reportProgress,
            observe: reportProgress ? 'events' : 'body'
        };

        return this.http.post(`${environment.apiUrl}/${endpoint}`, data, options);
    }

    get(endpoint: string) {
        return this.http.get(`${environment.apiUrl}/${endpoint}`);
    }

    getBlob(url: string, reportProgress: boolean = false, headers?: any) {
        // Handle full URL or relative
        const fullUrl = url.startsWith('http') ? url : `${environment.apiUrl}/${url}`;
        const options: any = {
            responseType: 'blob',
            reportProgress: reportProgress,
            observe: reportProgress ? 'events' : 'body',
            headers: headers
        };
        return this.http.get(fullUrl, options);
    }
}
