import { Injectable } from '@angular/core';
import { Geolocation } from '@capacitor/geolocation';
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot, query, where, orderBy, limit } from 'firebase/firestore';
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
            // 1. Check/Request Permissions
            const perm = await Geolocation.checkPermissions();
            if (perm.location !== 'granted') {
                const req = await Geolocation.requestPermissions();
                if (req.location !== 'granted') {
                    throw new Error("Location permission denied");
                }
            }

            // 2. Start Watching with robust timeout
            this.watchId = await Geolocation.watchPosition({
                enableHighAccuracy: true,
                timeout: 30000, // Boosted to 30s
                maximumAge: 3000
            }, (position, err) => {
                if (position) {
                    this.updateLocation(chatId, myId!, position.coords);
                }
                if (err) {
                    this.logger.error("WatchPosition callback error", err);
                }
            });

            // Set up expiry check
            this.expiryCheckInterval = setInterval(() => {
                if (Date.now() >= this.expiresAt) {
                    this.logger.log("Live location expired, stopping...");
                    this.stopSharing();
                }
            }, 30000); // Check every 30 seconds

        } catch (e: any) {
            this.logger.error("Start Sharing Failed", e);
            throw e; // Bubble up for UI feedback
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

    private lastLocationWriteTime: number = 0;
    private readonly LOCATION_THROTTLE_MS = 30000; // 30 seconds

    private async updateLocation(chatId: string, userId: string, coords: any) {
        const now = Date.now();
        // v10 Throttle: Avoid Firestore writes for minor/rapid movement
        if (now - this.lastLocationWriteTime < this.LOCATION_THROTTLE_MS) {
            return;
        }

        const ref = doc(this.db, 'chats', chatId, 'locations', userId);
        await setDoc(ref, {
            lat: coords.latitude,
            lng: coords.longitude,
            timestamp: Date.now(),
            expiresAt: this.expiresAt,
            userId: userId
        });
        this.lastLocationWriteTime = now;
    }

    /**
     * getLocations (v10): Watch locations + Audit the access
     */
    getLocations(chatId: string): Observable<any[]> {
        // Audit Access: Trace who viewed whom (Privacy Requirement)
        this.auditLocationAccess(chatId);

        return new Observable(observer => {
            const ref = collection(this.db, 'chats', chatId, 'locations');
            const unsub = onSnapshot(ref, (snapshot) => {
                const now = Date.now();
                const locations = snapshot.docs
                    .map(d => d.data())
                    .filter((loc: any) => {
                        if (loc.expiresAt && loc.expiresAt < now) return false;
                        if (!loc.expiresAt && loc.timestamp < now - 300000) return false;
                        return true;
                    });
                observer.next(locations);
            });
            return () => unsub();
        });
    }

    /**
     * auditLocationAccess (v10): Create an immutable trace of location viewing
     */
    private async auditLocationAccess(chatId: string) {
        const myId = localStorage.getItem('user_id');
        if (!myId) return;

        try {
            const auditRef = doc(collection(this.db, 'location_audit'));
            await setDoc(auditRef, {
                viewerId: myId,
                chatId: chatId,
                timestamp: Date.now(),
                type: 'view_live'
            });
        } catch (e) {
            this.logger.error("Location audit failed", e);
        }
    }

    // --- History (v16) ---
    getViewerHistory(chatId: string): Observable<any[]> {
        const ref = collection(this.db, 'location_audit');
        const q = query(ref, where('chatId', '==', chatId), orderBy('timestamp', 'desc'), limit(20));

        return new Observable(observer => {
            onSnapshot(q, (snap) => {
                observer.next(snap.docs.map(d => d.data()));
            });
        });
    }
}

