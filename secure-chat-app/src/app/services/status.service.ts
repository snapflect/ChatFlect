import { Injectable } from '@angular/core';
import { ApiService } from './api.service';

@Injectable({
    providedIn: 'root'
})
export class StatusService {

    constructor(private api: ApiService) { }

    getFeed() {
        return this.api.get('status.php?action=feed');
    }

    uploadStatus(file: File, caption: string) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('caption', caption);
        formData.append('user_id', localStorage.getItem('user_id') || '');

        return this.api.post('status.php', formData);
    }
}
