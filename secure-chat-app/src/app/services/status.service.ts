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

    // Upload Media Status
    uploadStatus(file: File, caption: string, privacy: string = 'everyone') {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', 'image'); // Default assumption, could be video
        formData.append('caption', caption);
        formData.append('privacy', privacy);
        formData.append('user_id', localStorage.getItem('user_id') || '');

        return this.api.post('status.php', formData);
    }

    // Upload Text Status
    uploadTextStatus(text: string, bgColor: string, font: string, privacy: string = 'everyone') {
        const formData = new FormData();
        formData.append('type', 'text');
        formData.append('text_content', text);
        formData.append('background_color', bgColor);
        formData.append('font', font);
        formData.append('privacy', privacy);
        formData.append('user_id', localStorage.getItem('user_id') || '');

        return this.api.post('status.php', formData);
    }
}
