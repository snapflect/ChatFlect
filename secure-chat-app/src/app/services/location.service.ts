import { Injectable } from '@angular/core';
import { Geolocation } from '@capacitor/geolocation';
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { BehaviorSubject, Observable } from 'rxjs';
import { LoggingService } from './logging.service';

@Injectable({
    providedIn: 'root'
})
export class LocationService {
    private db = getFirestore();
    private watchId: string | null = null;
    private currentChatId: string | null = null;

    public activeLocations = new BehaviorSubject<any[]>([]);

    constructor(private logger: LoggingService) { }

    async startSharing(chatId: string) {
        if (this.watchId) this.stopSharing();

        const myId = localStorage.getItem('user_id');
        this.currentChatId = chatId;

        try {
            this.watchId = await Geolocation.watchPosition({
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 5000
            }, (position, err) => {
                if (position) {
                    this.updateLocation(chatId, myId!, position.coords);
                }
            });
        } catch (e) {
            this.logger.error("Start Watching Failed", e);
        }
    }

    async stopSharing() {
        if (this.watchId) {
            await Geolocation.clearWatch({ id: this.watchId });
            this.watchId = null;
        }

        // Remove from Firestore
        if (this.currentChatId) {
            const myId = localStorage.getItem('user_id');
            const ref = doc(this.db, 'chats', this.currentChatId, 'locations', myId!);
            await deleteDoc(ref);
            this.currentChatId = null;
        }
    }

    private async updateLocation(chatId: string, userId: string, coords: any) {
        const ref = doc(this.db, 'chats', chatId, 'locations', userId);
        await setDoc(ref, {
            lat: coords.latitude,
            lng: coords.longitude,
            timestamp: Date.now(),
            userId: userId
        });
    }

    getLocations(chatId: string): Observable<any[]> {
        // Return observable of location array
        // We can use a simplified approach: specific method returns the Unsubscribe function?
        // Or return an Observable created from onSnapshot.

        return new Observable(observer => {
            const ref = collection(this.db, 'chats', chatId, 'locations');
            const unsub = onSnapshot(ref, (snapshot) => {
                const num = snapshot.docs.map(d => d.data());
                // Filter stale? (Checking timestamp > 5 mins ago?)
                observer.next(num);
            });
            return () => unsub();
        });
    }
}
