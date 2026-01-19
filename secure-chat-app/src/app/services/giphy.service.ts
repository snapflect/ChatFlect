import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

export interface GiphyGif {
    id: string;
    title: string;
    url: string;
    preview_url: string;
    width: number;
    height: number;
}

export interface GiphySearchResult {
    gifs: GiphyGif[];
    pagination: {
        total: number;
        count: number;
        offset: number;
    };
}

@Injectable({
    providedIn: 'root'
})
export class GiphyService {
    // GIPHY API configuration
    // Note: In production, use environment variables or backend proxy
    private readonly API_KEY = 'YOUR_GIPHY_API_KEY'; // Replace with actual key
    private readonly BASE_URL = 'https://api.giphy.com/v1/gifs';
    private readonly LIMIT = 25;

    constructor(private http: HttpClient) { }

    /**
     * Search for GIFs
     */
    searchGifs(query: string, offset: number = 0): Observable<GiphySearchResult> {
        if (!query.trim()) {
            return this.getTrendingGifs(offset);
        }

        const url = `${this.BASE_URL}/search`;
        const params = {
            api_key: this.API_KEY,
            q: query,
            limit: this.LIMIT.toString(),
            offset: offset.toString(),
            rating: 'pg-13',
            lang: 'en'
        };

        return this.http.get<any>(url, { params }).pipe(
            map(response => this.mapGiphyResponse(response)),
            catchError(() => of({ gifs: [], pagination: { total: 0, count: 0, offset: 0 } }))
        );
    }

    /**
     * Get trending GIFs
     */
    getTrendingGifs(offset: number = 0): Observable<GiphySearchResult> {
        const url = `${this.BASE_URL}/trending`;
        const params = {
            api_key: this.API_KEY,
            limit: this.LIMIT.toString(),
            offset: offset.toString(),
            rating: 'pg-13'
        };

        return this.http.get<any>(url, { params }).pipe(
            map(response => this.mapGiphyResponse(response)),
            catchError(() => of({ gifs: [], pagination: { total: 0, count: 0, offset: 0 } }))
        );
    }

    /**
     * Get GIF by ID
     */
    getGifById(id: string): Observable<GiphyGif | null> {
        const url = `${this.BASE_URL}/${id}`;
        const params = {
            api_key: this.API_KEY
        };

        return this.http.get<any>(url, { params }).pipe(
            map(response => {
                if (response.data) {
                    return this.mapGif(response.data);
                }
                return null;
            }),
            catchError(() => of(null))
        );
    }

    /**
     * Convert GIPHY API response to our format
     */
    private mapGiphyResponse(response: any): GiphySearchResult {
        const gifs = (response.data || []).map((gif: any) => this.mapGif(gif));
        return {
            gifs,
            pagination: {
                total: response.pagination?.total_count || 0,
                count: response.pagination?.count || 0,
                offset: response.pagination?.offset || 0
            }
        };
    }

    /**
     * Map single GIF object
     */
    private mapGif(gif: any): GiphyGif {
        const images = gif.images || {};
        const fixedWidth = images.fixed_width || {};
        const preview = images.fixed_width_small || images.preview_gif || {};

        return {
            id: gif.id,
            title: gif.title || '',
            url: fixedWidth.url || gif.url || '',
            preview_url: preview.url || fixedWidth.url || '',
            width: parseInt(fixedWidth.width) || 200,
            height: parseInt(fixedWidth.height) || 200
        };
    }

    /**
     * Download GIF as Blob for upload
     */
    downloadGifAsBlob(url: string): Observable<Blob> {
        return this.http.get(url, { responseType: 'blob' });
    }

    /**
     * Get GIPHY attribution info
     */
    getAttribution(): string {
        return 'Powered by GIPHY';
    }
}
