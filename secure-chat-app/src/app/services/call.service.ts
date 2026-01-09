import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { BehaviorSubject } from 'rxjs';
import { getFirestore, collection, doc, setDoc, updateDoc, onSnapshot, query, where, addDoc, getDocs } from 'firebase/firestore';
import { LoggingService } from './logging.service';

interface PeerSession {
    connection: RTCPeerConnection;
    stream?: MediaStream;
}

@Injectable({
    providedIn: 'root'
})
export class CallService {
    private db = getFirestore();

    // Multi-Peer State
    private peers: Map<string, PeerSession> = new Map();
    public localStream = new BehaviorSubject<MediaStream | null>(null);
    public remoteStreams = new BehaviorSubject<Map<string, MediaStream>>(new Map()); // Map<UserId, Stream>

    public callStatus = new BehaviorSubject<'idle' | 'calling' | 'incoming' | 'connected'>('idle');
    public activeCallType: 'audio' | 'video' = 'audio';
    public currentCallId: string | null = null;
    public incomingCallData: any = null;

    private signalUnsub: any = null;
    private callDocUnsub: any = null;

    private servers = {
        iceServers: [
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' }
        ]
    };

    constructor(
        private api: ApiService,
        private logger: LoggingService
    ) { }

    init() {
        // Listen for incoming calls (Invitations)
        const myId = localStorage.getItem('user_id');
        if (!myId) return;

        const callsRef = collection(this.db, 'calls');
        // Simple Query: Find calls where I am in 'participants' and status is 'active' or 'offer'
        // Firestore Array-Contains is useful here
        const q = query(callsRef, where('participants', 'array-contains', myId), where('status', '==', 'offer'));

        this.callDocUnsub = onSnapshot(q, (snapshot) => {
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const data: any = change.doc.data();
                    // Ignore if I initiated it
                    if (data.callerId !== myId && this.callStatus.value === 'idle') {
                        this.incomingCallData = { id: change.doc.id, ...data };
                        this.activeCallType = data.type || 'audio';
                        this.currentCallId = change.doc.id;
                        this.callStatus.next('incoming');
                    }
                }
            });
        });
    }

    // --- Actions ---

    async startGroupCall(participantIds: string[], type: 'audio' | 'video' = 'audio') {
        const myId = localStorage.getItem('user_id');
        if (!myId) return;

        this.activeCallType = type;
        await this.getMedia(type);

        // 1. Create Call Doc (The Room)
        const callDocRef = doc(collection(this.db, 'calls'));
        this.currentCallId = callDocRef.id;

        const allParticipants = [myId, ...participantIds];

        await setDoc(callDocRef, {
            id: this.currentCallId,
            callerId: myId,
            participants: allParticipants,
            type: type,
            status: 'offer', // Initial state
            created_at: Date.now()
        });

        // 2. Subscribe to Signaling
        this.subscribeToSignals(this.currentCallId);

        // 3. Initiate Connections to ALL participants
        // In Mesh, the Caller offers to everyone else.
        this.callStatus.next('calling');

        for (const pid of participantIds) {
            await this.initiatePeerConnection(pid, this.currentCallId);
        }
    }

    async answerCall() {
        if (!this.incomingCallData || !this.currentCallId) return;
        const myId = localStorage.getItem('user_id');

        await this.getMedia(this.activeCallType);
        this.callStatus.next('connected');

        // Subscribe to signals in this room
        this.subscribeToSignals(this.currentCallId);

        // Update Call Status to 'active' if I'm the first answerer? 
        // Or just join.
        // For Mesh: When I join, I check existing signals.
        // But also, I should issue OFFERS to anyone who hasn't offered to me?
        // Simplified: The Caller already sent Offers to me (via Signals collection).
        // I process them.
    }

    async endCall() {
        if (this.currentCallId) {
            // Remove myself from participants? Or just close my connections.
            // For MVP: Just close local.
            // Also update status if I am caller?
        }
        this.cleanup();
    }

    // --- Signaling & Mesh Logic ---

    private subscribeToSignals(callId: string) {
        const myId = localStorage.getItem('user_id');
        const signalsRef = collection(this.db, 'calls', callId, 'signals');
        // Listen for signals meant for ME
        const q = query(signalsRef, where('to', '==', myId));

        this.signalUnsub = onSnapshot(q, async (snapshot) => {
            snapshot.docChanges().forEach(async change => {
                if (change.type === 'added') {
                    const data: any = change.doc.data();
                    await this.handleSignal(data);
                }
            });
        });
    }

    private async handleSignal(data: any) {
        const remotePeerId = data.from;

        // 1. OFFER
        if (data.type === 'offer') {
            const pc = this.getOrCreatePeer(remotePeerId, this.currentCallId!);
            await pc.setRemoteDescription(new RTCSessionDescription(data.payload));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            this.sendSignal(remotePeerId, 'answer', answer);
        }

        // 2. ANSWER
        else if (data.type === 'answer') {
            const pc = this.peers.get(remotePeerId)?.connection;
            if (pc && pc.signalingState === 'have-local-offer') {
                await pc.setRemoteDescription(new RTCSessionDescription(data.payload));
            }
        }

        // 3. CANDIDATE
        else if (data.type === 'candidate') {
            const pc = this.peers.get(remotePeerId)?.connection;
            if (pc) {
                await pc.addIceCandidate(new RTCIceCandidate(data.payload));
            }
        }
    }

    private async initiatePeerConnection(targetPeerId: string, callId: string) {
        const pc = this.getOrCreatePeer(targetPeerId, callId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        this.sendSignal(targetPeerId, 'offer', offer);
    }

    private getOrCreatePeer(peerId: string, callId: string): RTCPeerConnection {
        if (this.peers.has(peerId)) return this.peers.get(peerId)!.connection;

        const pc = new RTCPeerConnection(this.servers);

        // Add Local Tracks
        this.localStream.value?.getTracks().forEach(track => {
            pc.addTrack(track, this.localStream.value!);
        });

        // ICE Candidates
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.sendSignal(peerId, 'candidate', event.candidate.toJSON());
            }
        };

        // Remote Stream
        pc.ontrack = (event) => {
            if (event.streams && event.streams[0]) {
                const map = this.remoteStreams.value;
                map.set(peerId, event.streams[0]);
                this.remoteStreams.next(new Map(map)); // Trigger Update
            }
        };

        // Store
        this.peers.set(peerId, { connection: pc });
        return pc;
    }

    private async sendSignal(to: string, type: 'offer' | 'answer' | 'candidate', payload: any) {
        if (!this.currentCallId) return;
        const myId = localStorage.getItem('user_id');
        const signalsRef = collection(this.db, 'calls', this.currentCallId, 'signals');
        await addDoc(signalsRef, {
            from: myId,
            to: to,
            type: type,
            payload: payload // SDP or Candidate object
        });
    }

    // --- Media & Utils ---

    private async getMedia(type: 'audio' | 'video') {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: type === 'video' ? { facingMode: 'user' } : false
            });
            this.localStream.next(stream);
        } catch (e) {
            this.logger.error("User Media Error", e);
            throw e;
        }
    }

    toggleAudio(enabled: boolean) {
        this.localStream.value?.getAudioTracks().forEach(t => t.enabled = enabled);
    }

    toggleVideo(enabled: boolean) {
        this.localStream.value?.getVideoTracks().forEach(t => t.enabled = enabled);
    }

    async switchCamera() {
        if (this.activeCallType !== 'video') return;

        const currentStream = this.localStream.value;
        if (!currentStream) return;

        const videoTrack = currentStream.getVideoTracks()[0];
        if (!videoTrack) return;

        const settings = videoTrack.getSettings();
        const currentMode = settings.facingMode;
        const newMode = currentMode === 'user' ? 'environment' : 'user';

        videoTrack.stop();
        currentStream.removeTrack(videoTrack);

        try {
            const newStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: newMode },
                audio: false
            });
            const newTrack = newStream.getVideoTracks()[0];

            currentStream.addTrack(newTrack);
            this.localStream.next(currentStream);

            // Replace track in ALL peer connections
            this.peers.forEach(p => {
                const sender = p.connection.getSenders().find(s => s.track?.kind === 'video');
                if (sender) sender.replaceTrack(newTrack);
            });

        } catch (e) {
            this.logger.error("Switch Camera Error", e);
        }
    }

    private cleanup() {
        this.localStream.value?.getTracks().forEach(t => t.stop());

        // Close all peers
        this.peers.forEach(p => p.connection.close());
        this.peers.clear();

        this.localStream.next(null);
        this.remoteStreams.next(new Map());
        this.callStatus.next('idle');

        if (this.signalUnsub) this.signalUnsub();
        if (this.callDocUnsub) { /* Don't stop listening for invites? */ }
        // actually we want to keep listening for invites, but maybe reset specific listeners
        this.signalUnsub = null;
    }

    getCallHistory(): any {
        const myId = localStorage.getItem('user_id');
        return this.api.post('calls.php', {
            action: 'history',
            user_id: myId
        });
    }
}
