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

    // Upload Media Status (Image/Video/Audio)
    uploadStatus(file: File, caption: string, type: 'image' | 'video' | 'audio' = 'image', privacy: string = 'everyone') {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', type);
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

    recordView(statusId: string) {
        return this.api.post('status.php?action=view', {
            status_id: statusId,
            viewer_id: localStorage.getItem('user_id')
        });
    }

    getViewers(statusId: string) {
        return this.api.get(`status.php?action=viewers&status_id=${statusId}`);
    }
}
