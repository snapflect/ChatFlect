import { Injectable } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, onSnapshot, updateDoc, deleteField, serverTimestamp } from 'firebase/firestore';
import { environment } from 'src/environments/environment';
import { AppState } from '@capacitor/app';
import { Observable, BehaviorSubject } from 'rxjs';
import { LoggingService } from './logging.service';

@Injectable({
    providedIn: 'root'
})
export class PresenceService {
    private db: any;
    private myId: string | null = null;
    private typingTimeout: any;

    constructor(private logger: LoggingService) {
        const app = initializeApp(environment.firebase);
        this.db = getFirestore(app);
        this.myId = localStorage.getItem('user_id');
    }

    // Set Global Online Status
    async setPresence(status: 'online' | 'offline') {
        if (!this.myId) return;
        try {
            const userStatusRef = doc(this.db, 'status', this.myId);
            const payload = {
                state: status,
                last_changed: serverTimestamp(),
                platform: 'mobile'
            };
            await setDoc(userStatusRef, payload, { merge: true });
        } catch (e) {
            this.logger.error('Error setting presence', e);
        }
    }

    // Watch another user's status
    getPresence(userId: string): Observable<any> {
        return new Observable(observer => {
            const docRef = doc(this.db, 'status', userId);
            const unsub = onSnapshot(docRef, (doc) => {
                observer.next(doc.data() || { state: 'offline' });
            });
            return () => unsub();
        });
    }

    // --- Typing Indicators (Ephemeral via Chat Doc) ---
    // We store typing status in the Chat Document itself to avoid a separate high-write collection
    // Structure: { typing: { "USER_ID": timestamp } }

    async setTyping(chatId: string, isTyping: boolean) {
        if (!this.myId) return;
        try {
            const chatRef = doc(this.db, 'chats', chatId);
            if (isTyping) {
                await updateDoc(chatRef, {
                    [`typing.${this.myId}`]: Date.now()
                });

                // Auto-clear after 5s just in case (client-side only for now, typically UI handles debouncing)
            } else {
                await updateDoc(chatRef, {
                    [`typing.${this.myId}`]: deleteField()
                });
            }
        } catch (e) {
            // Silent fail for typing usually ok
        }
    }
}
