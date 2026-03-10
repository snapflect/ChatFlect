import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
    providedIn: 'root'
})
export class ApiService {
    constructor(private http: HttpClient) { }

    post(endpoint: string, data: any, reportProgress: boolean = false, headers?: any): Observable<any> {
        const options: any = {
            reportProgress: reportProgress,
            observe: reportProgress ? 'events' : 'body',
            headers: headers,
            withCredentials: true // STRICT FIX: Include auth cookies
        };

        return this.http.post(`${environment.apiUrl}/${endpoint}`, data, options);
    }

    delete(endpoint: string): Observable<any> {
        const url = `${environment.apiUrl}/${endpoint}`;
        return this.http.delete(url, { withCredentials: true }); // STRICT FIX
    }

    get(endpoint: string): Observable<any> {
        return this.http.get(`${environment.apiUrl}/${endpoint}`, { withCredentials: true }); // STRICT FIX
    }

    getBlob(url: string, reportProgress: boolean = false, headers?: any) {
        // Handle full URL or relative
        const fullUrl = url.startsWith('http') ? url : `${environment.apiUrl}/${url}`;
        const options: any = {
            responseType: 'blob',
            reportProgress: reportProgress,
            headers: headers,
            withCredentials: true // STRICT FIX: Include auth cookies for media
        };
        return this.http.get(fullUrl, options);
    }
}
