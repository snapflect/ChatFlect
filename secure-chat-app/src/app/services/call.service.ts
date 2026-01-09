import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { BehaviorSubject, from } from 'rxjs';
import { getFirestore, collection, doc, setDoc, updateDoc, onSnapshot, query, where, addDoc, getDocs } from 'firebase/firestore';
import { LoggingService } from './logging.service';
import { PushService } from './push.service';

interface PeerSession {
    connection: RTCPeerConnection;
    stream?: MediaStream;
    candidateBuffer: any[];
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
    private signalBuffer: any[] = []; // Buffer for Pre-Answer signals

    private signalUnsub: any = null;
    private callDocUnsub: any = null;

    private servers = {
        iceServers: [
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' }
        ],
        iceCandidatePoolSize: 10
    };

    constructor(
        private api: ApiService,
        private logger: LoggingService,
        private pushService: PushService
    ) { }

    init() {
        // Listen for incoming calls (Invitations)
        const myId = localStorage.getItem('user_id');
        if (!myId) return;

        // Listen for incoming calls (Invitations)
        const callsRef = collection(this.db, 'calls');
        // Simple Query: Find calls where I am in 'participants' and status is 'active' or 'offer'
        const q = query(callsRef, where('participants', 'array-contains', myId), where('status', '==', 'offer'));

        this.callDocUnsub = onSnapshot(q, (snapshot) => {
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const data: any = change.doc.data();
                    // Ignore if I initiated it
                    if (data.callerId !== myId && this.callStatus.value === 'idle') {
                        // IGNORE STALE CALLS (> 5 Minutes Old)
                        const now = Date.now();
                        const callTime = data.created_at || 0;
                        if (now - callTime > 300000) {
                            this.logger.log("[Call] Ignoring stale call invite:", change.doc.id);
                            return;
                        }

                        this.incomingCallData = { id: change.doc.id, ...data };
                        this.activeCallType = data.type || 'audio';
                        this.currentCallId = change.doc.id;
                        // Subscribe immediately to catch Early Media/Candidates
                        this.subscribeToSignals(this.currentCallId!);
                        this.callStatus.next('incoming');
                    }
                }
            });
        });

        // Listen for Signals (Global Listener for My ID)
        // Note: In a real app, signals should probably be sub-collection of 'calls' OR a top-level 'signals' collection.
        // Current logic: `calls/{callId}/signals`. This makes global listening hard without knowing Call ID.
        // ISSUE: We only know Call ID *after* we get the invitation.
        // FIX: The current logic `subscribeToSignals(callId)` is actually correct for this schema, 
        // BUT we must ensure it's called IMMEDIATELY upon receiving the invite (even before answering?)
        // OR better: The Caller sends the OFFER signal *after* creating the doc.
        // We receive the Invite (Call Doc Added) -> We know Call ID -> We Subscribe to Signals -> We see Offer?
        // Let's verify `answerCall` logic. It calls `subscribeToSignals` too late?
        // Correct Flow:
        // 1. Incoming Call Detected (lines 53-66).
        // 2. We should subscribe to signals *immediately* here to buffer candidates/offers?
        //    YES.
    }

    // --- Actions ---

    async startGroupCall(participantIds: string[], type: 'audio' | 'video' = 'audio') {
        const myId = localStorage.getItem('user_id');
        if (!myId) return;

        if (participantIds.length > 7) { // 7 others + me = 8
            this.logger.error("Call Limit Exceeded");
            // Ideally assume caller UI handles the error via catch, but let's throw
            throw new Error("Group Call Limit: Max 8 Participants");
        }

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

        // Parallel: Connection Init & Push Notification
        const promises = participantIds.map(async (pid) => {
            // A. WebRTC Connection
            await this.initiatePeerConnection(pid, this.currentCallId!);

            // B. Push Notification (Wake up the device)
            await this.pushService.sendPush(
                pid,
                'Incoming Call',
                'Tap to answer',
                {
                    type: 'call_invite',
                    callId: this.currentCallId,
                    callerId: myId,
                    callType: type
                }
            );
        });

        await Promise.all(promises);
    }

    async answerCall() {
        if (!this.incomingCallData || !this.currentCallId) return;
        const myId = localStorage.getItem('user_id');
        if (!myId) return;

        const callId = this.currentCallId;

        await this.getMedia(this.activeCallType);
        this.callStatus.next('connected');

        // Subscribe to signals in this room - ALREADY SUBSCRIBED IN INIT
        // But we need to process the BUFFERED signals now.
        this.logger.log("[Call] Processing Buffered Signals:", this.signalBuffer.length);
        while (this.signalBuffer.length > 0) {
            const data = this.signalBuffer.shift();
            await this.handleSignal(data);
        }

        // --- FULL MESH LOGIC ---
        // 1. Join the call document (add myself to participants if not there? 
        //    Actually, usually the caller adds everyone. Assuming I am in the list.)

        // 2. Connect to existing peers
        // Logic: Iterate all participants.
        // If (MyID < TheirID) AND (Not Connected), I OFFER.
        // If (MyID > TheirID), I WAIT (They will OFFER).
        // Exception: The Caller (Initiator) usually offers to everyone regardless of ID to kickstart?
        //    Current implementation: Caller offers to everyone in startGroupCall.
        //    So if I am NOT Caller, I wait for Caller's offer (which is already sent).
        //    But for OTHER Joiners (Fellow Guests), we need to peer up.

        const participants = this.incomingCallData.participants || [];
        const callerId = this.incomingCallData.callerId;

        for (const pid of participants) {
            if (pid === myId) continue; // Skip self

            // Check if already connected (e.g. Caller)
            if (this.peers.has(pid)) continue;

            // If it's the Caller, I expect an Offer from them (standard flow).
            // But if I missed it? The signals query should catch it (onSnapshot).
            if (pid === callerId) continue;

            // For other peers (Guests):
            // Deterministic Rule: Lower ID offers to Higher ID.
            if (myId < pid) {
                this.logger.log(`[Mesh] Initiating connection to peer ${pid} (I am Lower ID)`);
                await this.initiatePeerConnection(pid, callId);
            } else {
                this.logger.log(`[Mesh] Waiting for peer ${pid} to offer (I am Higher ID)`);
            }
        }
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
        // BUFFERING: If we are in 'incoming' state (haven't answered yet), buffer the signal.
        if (this.callStatus.value === 'incoming') {
            this.logger.log("[Signal] Buffering signal (Pre-Answer):", data.type);
            this.signalBuffer.push(data);
            return;
        }

        const remotePeerId = data.from;

        // SECURITY CHECK: Verify the sender is actually a participant in this call
        // This prevents random users from injecting signals to disrupt/hijack the call.
        if (this.incomingCallData && this.incomingCallData.participants) {
            const participants: string[] = this.incomingCallData.participants;
            if (!participants.includes(remotePeerId)) {
                this.logger.error("[Security] dropping signal from unknown peer:", remotePeerId);
                return;
            }
        }

        this.logger.log("[Signal] Processing:", data.type, "from", remotePeerId);

        // 1. OFFER
        if (data.type === 'offer') {
            const pc = this.getOrCreatePeer(remotePeerId, this.currentCallId!);
            await pc.setRemoteDescription(new RTCSessionDescription(data.payload));

            // Process Buffered Candidates
            const session = this.peers.get(remotePeerId);
            if (session && session.candidateBuffer.length > 0) {
                for (const candidate of session.candidateBuffer) {
                    await pc.addIceCandidate(new RTCIceCandidate(candidate));
                }
                session.candidateBuffer = []; // Clear buffer
            }

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
            const session = this.peers.get(remotePeerId);
            if (session) {
                const pc = session.connection;
                if (pc.remoteDescription) {
                    await pc.addIceCandidate(new RTCIceCandidate(data.payload));
                } else {
                    // Buffer it
                    session.candidateBuffer.push(data.payload);
                }
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
        this.peers.set(peerId, { connection: pc, candidateBuffer: [] });
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
        if (!myId) return Promise.resolve([]);

        const callsRef = collection(this.db, 'calls');
        const q = query(callsRef, where('participants', 'array-contains', myId));

        return from(getDocs(q).then(snap => {
            return snap.docs.map(d => {
                const data = d.data();
                return {
                    id: d.id,
                    ...data,
                    // Map generic fields to what UI expects
                    caller_id: data['callerId'] || data['caller_id'],
                    created_at: data['created_at'] || Date.now()
                };
            }).sort((a: any, b: any) => b.created_at - a.created_at);
        }).catch(e => {
            this.logger.error("Get Call History Failed", e);
            return [];
        }));
    }
}
