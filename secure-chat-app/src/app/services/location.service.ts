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
    private expiresAt: number = 0; // Timestamp when sharing expires
    private expiryCheckInterval: any = null;

    public activeLocations = new BehaviorSubject<any[]>([]);

    constructor(private logger: LoggingService) { }

    /**
     * Start sharing location for a given duration
     * @param chatId Chat ID
     * @param durationMinutes Duration in minutes (15, 60, or 480)
     */
    async startSharing(chatId: string, durationMinutes: number = 15) {
        if (this.watchId) this.stopSharing();

        const myId = localStorage.getItem('user_id');
        this.currentChatId = chatId;
        this.expiresAt = Date.now() + (durationMinutes * 60 * 1000);

        // Persist to localStorage for state recovery
        localStorage.setItem('live_location_chatId', chatId);
        localStorage.setItem('live_location_expiresAt', String(this.expiresAt));

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

            // Set up expiry check
            this.expiryCheckInterval = setInterval(() => {
                if (Date.now() >= this.expiresAt) {
                    this.logger.log("Live location expired, stopping...");
                    this.stopSharing();
                }
            }, 30000); // Check every 30 seconds

        } catch (e) {
            this.logger.error("Start Watching Failed", e);
        }
    }

    async stopSharing() {
        if (this.watchId) {
            await Geolocation.clearWatch({ id: this.watchId });
            this.watchId = null;
        }

        if (this.expiryCheckInterval) {
            clearInterval(this.expiryCheckInterval);
            this.expiryCheckInterval = null;
        }

        // Remove from Firestore
        if (this.currentChatId) {
            const myId = localStorage.getItem('user_id');
            const ref = doc(this.db, 'chats', this.currentChatId, 'locations', myId!);
            await deleteDoc(ref);
            this.currentChatId = null;
        }
        this.expiresAt = 0;

        // Clear localStorage
        localStorage.removeItem('live_location_chatId');
        localStorage.removeItem('live_location_expiresAt');
    }

    isSharing(): boolean {
        // Check in-memory first
        if (this.watchId !== null && Date.now() < this.expiresAt) {
            return true;
        }
        // Recover from localStorage if in-memory is empty
        const storedExpiry = localStorage.getItem('live_location_expiresAt');
        if (storedExpiry) {
            const expiry = parseInt(storedExpiry, 10);
            if (Date.now() < expiry) {
                this.expiresAt = expiry; // Restore
                return true;
            } else {
                // Expired, clean up
                localStorage.removeItem('live_location_chatId');
                localStorage.removeItem('live_location_expiresAt');
            }
        }
        return false;
    }

    getRemainingTime(): number {
        // Try localStorage recovery if needed
        if (this.expiresAt === 0) {
            const storedExpiry = localStorage.getItem('live_location_expiresAt');
            if (storedExpiry) {
                this.expiresAt = parseInt(storedExpiry, 10);
            }
        }
        if (Date.now() >= this.expiresAt) return 0;
        return Math.max(0, this.expiresAt - Date.now());
    }

    private async updateLocation(chatId: string, userId: string, coords: any) {
        const ref = doc(this.db, 'chats', chatId, 'locations', userId);
        await setDoc(ref, {
            lat: coords.latitude,
            lng: coords.longitude,
            timestamp: Date.now(),
            expiresAt: this.expiresAt,
            userId: userId
        });
    }

    getLocations(chatId: string): Observable<any[]> {
        return new Observable(observer => {
            const ref = collection(this.db, 'chats', chatId, 'locations');
            const unsub = onSnapshot(ref, (snapshot) => {
                const now = Date.now();
                const locations = snapshot.docs
                    .map(d => d.data())
                    .filter((loc: any) => {
                        // Filter out expired locations (expiresAt < now)
                        // Also filter stale (no update in 5 mins and no expiresAt)
                        if (loc.expiresAt && loc.expiresAt < now) return false;
                        if (!loc.expiresAt && loc.timestamp < now - 300000) return false;
                        return true;
                    });
                observer.next(locations);
            });
            return () => unsub();
        });
    }
}

