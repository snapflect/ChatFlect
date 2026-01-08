import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { BehaviorSubject } from 'rxjs';
import { getFirestore, collection, doc, setDoc, updateDoc, onSnapshot, query, where, addDoc } from 'firebase/firestore';
import { LoggingService } from './logging.service';

@Injectable({
    providedIn: 'root'
})
export class CallService {
    private db = getFirestore();
    private peerConnection: RTCPeerConnection | null = null;
    public localStream = new BehaviorSubject<MediaStream | null>(null);
    public remoteStream = new BehaviorSubject<MediaStream | null>(null);

    public callStatus = new BehaviorSubject<'idle' | 'calling' | 'incoming' | 'connected'>('idle');
    public activeCallType: 'audio' | 'video' = 'audio';
    public incomingCallData: any = null;
    public currentCallId: string | null = null;
    public activeCallDocRef: any = null; // Firestore Doc Ref

    private unsubscribe: any = null;
    private callUnsubscribe: any = null;
    private candidatesUnsubscribe: any = null;

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
        // Listen for incoming calls
        const myId = localStorage.getItem('user_id');
        if (!myId) return;

        const callsRef = collection(this.db, 'calls');
        const q = query(callsRef, where('calleeId', '==', myId), where('status', '==', 'offer'));

        this.unsubscribe = onSnapshot(q, (snapshot) => {
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const data: any = change.doc.data();
                    const id = change.doc.id;
                    if (this.callStatus.value === 'idle') {
                        this.incomingCallData = { id, ...data };
                        this.activeCallType = data.type || 'audio';
                        this.currentCallId = id;
                        this.callStatus.next('incoming');
                    }
                }
            });
        });
    }

    async startCall(calleeId: string, type: 'audio' | 'video' = 'audio') {
        const myId = localStorage.getItem('user_id');
        this.activeCallType = type;

        // 1. Get User Media
        await this.getMedia(type);

        // 2. Create Peer Connection
        this.createPeerConnection();

        // 3. Add Tracks
        this.localStream.value?.getTracks().forEach(track => {
            this.peerConnection?.addTrack(track, this.localStream.value!);
        });

        // 4. Create Offer
        const offer = await this.peerConnection?.createOffer();
        await this.peerConnection?.setLocalDescription(offer);

        // 5. Send Offer to Firestore (Signaling)
        const callDocRef = doc(collection(this.db, 'calls'));
        this.currentCallId = callDocRef.id;
        this.activeCallDocRef = callDocRef;

        await setDoc(callDocRef, {
            id: this.currentCallId,
            callerId: myId,
            calleeId: calleeId,
            type: type,
            status: 'offer',
            offer: {
                type: offer?.type,
                sdp: offer?.sdp
            }
        });

        // 6. Log in SQL Backend
        this.api.post('calls.php', {
            action: 'initiate',
            caller_id: myId,
            receiver_id: calleeId,
            type: type
        }).subscribe();

        this.callStatus.next('calling');

        // 7. Listen for Answer
        this.callUnsubscribe = onSnapshot(callDocRef, (snapshot) => {
            const data: any = snapshot.data();
            if (!data) return;

            if (data.status === 'answer' && data.answer && this.peerConnection?.signalingState === 'have-local-offer') {
                this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
                this.callStatus.next('connected');
            }
            if (data.status === 'ended') {
                this.cleanup();
            }
        });

        // 8. Listen for ICE Candidates (Callee -> Caller)
        const candidatesRef = collection(callDocRef, 'calleeCandidates');
        this.candidatesUnsubscribe = onSnapshot(candidatesRef, (snapshot) => {
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const cand = change.doc.data();
                    this.peerConnection?.addIceCandidate(new RTCIceCandidate(cand));
                }
            });
        });
    }

    async answerCall() {
        if (!this.incomingCallData) return;
        const callId = this.incomingCallData.id;
        this.currentCallId = callId;
        const callDocRef = doc(this.db, 'calls', callId);
        this.activeCallDocRef = callDocRef;

        // 1. Get Media
        const type = this.incomingCallData.type || 'audio';
        await this.getMedia(type);

        // 2. Create Peer Connection
        this.createPeerConnection();

        // 3. Add Tracks
        this.localStream.value?.getTracks().forEach(track => {
            this.peerConnection?.addTrack(track, this.localStream.value!);
        });

        // 4. Set Remote Description (The Offer)
        const offer = this.incomingCallData.offer;
        await this.peerConnection?.setRemoteDescription(new RTCSessionDescription(offer));

        // 5. Create Answer
        const answer = await this.peerConnection?.createAnswer();
        await this.peerConnection?.setLocalDescription(answer);

        // 6. Update Firestore with Answer
        await updateDoc(callDocRef, {
            status: 'answer',
            answer: {
                type: answer?.type,
                sdp: answer?.sdp
            }
        });

        this.callStatus.next('connected');

        // 7. Listen for Caller ICE Candidates
        const candidatesRef = collection(callDocRef, 'callerCandidates');
        this.candidatesUnsubscribe = onSnapshot(candidatesRef, (snapshot) => {
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const cand = change.doc.data();
                    this.peerConnection?.addIceCandidate(new RTCIceCandidate(cand));
                }
            });
        });
    }

    async endCall() {
        if (this.activeCallDocRef) {
            await updateDoc(this.activeCallDocRef, { status: 'ended' });
        }
        if (this.currentCallId) {
            this.api.post('calls.php', { action: 'end', call_id: this.currentCallId }).subscribe();
        }
        this.cleanup();
    }

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

    private createPeerConnection() {
        this.peerConnection = new RTCPeerConnection(this.servers);

        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate && this.currentCallId && this.activeCallDocRef) {
                const collectionName = this.callStatus.value === 'calling' ? 'callerCandidates' : 'calleeCandidates';
                addDoc(collection(this.activeCallDocRef, collectionName), event.candidate.toJSON());
            }
        };

        this.peerConnection.ontrack = (event) => {
            if (event.streams && event.streams[0]) {
                this.remoteStream.next(event.streams[0]);
            }
        };

        this.peerConnection.onconnectionstatechange = () => {
            if (this.peerConnection?.connectionState === 'disconnected' ||
                this.peerConnection?.connectionState === 'failed' ||
                this.peerConnection?.connectionState === 'closed') {
                this.cleanup();
            }
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

        // 1. Get current video track
        const videoTrack = currentStream.getVideoTracks()[0];
        if (!videoTrack) return;

        // 2. Get constraints to flip
        const settings = videoTrack.getSettings();
        const currentMode = settings.facingMode;
        const newMode = currentMode === 'user' ? 'environment' : 'user';

        // 3. Stop old track
        videoTrack.stop();
        currentStream.removeTrack(videoTrack);

        // 4. Get new stream
        try {
            const newStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: newMode },
                audio: false
            });
            const newTrack = newStream.getVideoTracks()[0];

            // 5. Add to local stream and peer connection
            currentStream.addTrack(newTrack);
            this.localStream.next(currentStream); // Trigger UI update

            if (this.peerConnection) {
                const sender = this.peerConnection.getSenders().find(s => s.track?.kind === 'video');
                if (sender) {
                    sender.replaceTrack(newTrack);
                }
            }
        } catch (e) {
            this.logger.error("Switch Camera Error", e);
        }
    }

    private cleanup() {
        // Stop Tracks
        this.localStream.value?.getTracks().forEach(t => t.stop());

        // Unsubscribe FS
        if (this.callUnsubscribe) { this.callUnsubscribe(); this.callUnsubscribe = null; }
        if (this.candidatesUnsubscribe) { this.candidatesUnsubscribe(); this.candidatesUnsubscribe = null; }

        this.peerConnection?.close();
        this.peerConnection = null;
        this.localStream.next(null);
        this.remoteStream.next(null);
        this.callStatus.next('idle');
        this.incomingCallData = null;
        this.currentCallId = null;
        this.activeCallDocRef = null;
    }
}
