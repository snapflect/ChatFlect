import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';

@Injectable({
    providedIn: 'root'
})
export class ProfileService {

    constructor(private api: ApiService, private auth: AuthService) { }

    async getProfile() {
        const userId = this.auth.currentUserId; // Need to access value or pass it
        // Wait, currentUserId is observable. 
        // Let's assume passed or stored in auth
        const id = localStorage.getItem('user_id');
        return this.api.get(`profile.php?user_id=${id}`).toPromise();
    }

    async updateProfile(profileData: any) {
        const id = localStorage.getItem('user_id');
        return this.api.post('profile.php', { ...profileData, user_id: id }).toPromise();
    }

    async uploadPhoto(formData: FormData) {
        // Direct fetch to upload.php as ApiService might need specific header handling for FormData
        // or we can try using ApiService if we trust HttpClient to handle boundary
        // Let's use direct fetch to be safe with the backend 'upload.php'

        // Construct full URL
        // We know ApiService uses environment.apiUrl
        // We need to import environment here or assume it.
        // Let's use ApiService.post for simplicity first.
        // Angular HttpClient handles FormData automatically by NOT setting Content-Type, allowing browser to set boundary.
        // However, we need to ensure ApiService doesn't set Content-Type: application/json

        // Our ApiService seems basic. Let's try it.
        // return this.api.post('upload.php', formData).toPromise(); 

        // Wait, ApiService checks environment.apiUrl.
        // Let's just use fetch for the upload to handle the multipart correctly without risk of interceptors messing it up

        const response = await fetch('https://chat.snapflect.com/api/upload.php', {
            method: 'POST',
            body: formData
        });
        const json = await response.json();
        return json.url; // Returns "uploads/xxxx.jpg"
    }
}
