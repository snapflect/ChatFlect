import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { BehaviorSubject, from } from 'rxjs';
import { getFirestore, collection, doc, setDoc, updateDoc, onSnapshot, query, where, addDoc, getDocs, getDoc } from 'firebase/firestore';
import { LoggingService } from './logging.service';
import { PushService } from './push.service';
import { SoundService } from './sound.service';
import { AudioToggle } from 'capacitor-plugin-audio-toggle';
import { CallKitService } from './callkit.service';

interface PeerSession {
    connection: RTCPeerConnection;
    stream?: MediaStream;
    candidateBuffer: any[];
}

@Injectable({
    providedIn: 'root'
})
export class CallService {
    private db: any;

    // Multi-Peer State
    private peers: Map<string, any> = new Map(); // Map<UserId, { connection: RTCPeerConnection, tracks: [] }>
    public localStream = new BehaviorSubject<MediaStream | null>(null);
    public remoteStreams = new BehaviorSubject<Map<string, MediaStream>>(new Map()); // Map<UserId, Stream>

    public callStatus = new BehaviorSubject<'idle' | 'calling' | 'incoming' | 'connected' | 'declined' | 'busy'>('idle');
    public activeCallType: 'audio' | 'video' = 'audio';
    public isOutgoingCall: boolean = false; // true = I started the call, false = I received the call
    public isGroupCall: boolean = false; // true = group call (3+ participants), false = 1:1 call
    public currentCallId: string | null = null;
    public incomingCallData: any = null;
    public otherPeerId: string | null = null; // For 1:1 calls, store the other person's ID
    private signalBuffer: any[] = []; // Buffer for Pre-Answer signals

    private signalUnsub: any = null;
    private callDocUnsub: any = null;
    private ringtoneTimeout: any = null; // 60s timeout for incoming call
    private ringbackTimeout: any = null; // 60s timeout for outgoing call
    public callEndReason: 'completed' | 'missed' | 'declined' | 'busy' | 'cancelled' = 'completed'; // For call history
    public callStartTime: number = 0; // For call duration

    private servers = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' }
        ]
    };

    constructor(
        private api: ApiService,
        private logger: LoggingService,
        private pushService: PushService,
        private soundService: SoundService,
        private callKit: CallKitService
    ) {
        try {
            this.db = getFirestore();
        } catch (e) {
            this.logger.error("[Call] Failed to init Firestore in service", e);
        }
    }

    init() {
        // Init Native CallKit
        this.callKit.init();

        // Listen for Native Actions
        this.callKit.lastCallAction.subscribe(action => {
            if (!action) return;
            if (action.type === 'answered') {
                this.logger.log("[Call] Native Call Answered - Triggering WebRTC...");
                // Assuming we have the incoming call data cached or refreshed
                // Need to ensure `currentCallId` is set if app was cold-started.
                // For MVP, we assume app was awakened by Push -> Incoming Call Logic ran -> currentCallId set.
                this.answerCall();
            } else if (action.type === 'ended') {
                this.logger.log("[Call] Native Call Ended");
                this.endCall();
            }
        });

        // Prevent duplicate listeners
        if (this.callDocUnsub) {
            this.logger.log("[CallService] Clearing previous listener before re-init");
            this.callDocUnsub();
            this.callDocUnsub = null;
        }

        // Listen for incoming calls (Invitations)
        const myId = localStorage.getItem('user_id');
        if (!myId) return;

        // Listen for incoming calls (Invitations)
        const callsRef = this.firestoreCollection(this.db, 'calls');
        // Simple Query: Find calls where I am in 'participants' and status is 'active' or 'offer'
        const q = this.firestoreQuery(callsRef, where('participants', 'array-contains', myId), where('status', '==', 'offer'));

        this.callDocUnsub = this.firestoreOnSnapshot(q, (snapshot) => {
            snapshot.docChanges().forEach(async (change: any) => {
                if (change.type === 'added') {
                    const data: any = change.doc.data();

                    // CRITICAL CHECK: If we are already handling this call (e.g. connected), ignore.
                    if (this.currentCallId === change.doc.id && this.callStatus.value !== 'idle') {
                        this.logger.log("[Call] Ignoring duplicate/update for active call:", change.doc.id);
                        return;
                    }

                    // Ignore if I initiated it
                    if (data.callerId !== myId) {
                        // IGNORE STALE CALLS (> 5 Minutes Old)
                        const now = Date.now();
                        const callTime = data.created_at || 0;
                        if (now - callTime > 300000) {
                            this.logger.log("[Call] Ignoring stale call invite:", change.doc.id);
                            return;
                        }

                        // BUSY DETECTION - If already on a call, send busy signal (WhatsApp behavior)
                        if (this.callStatus.value !== 'idle') {
                            this.logger.log("[Call] Already on a call - sending busy signal to:", data.callerId);
                            // Temporarily set currentCallId to send signal
                            const tempCallId = this.currentCallId;
                            this.currentCallId = change.doc.id;
                            await this.sendSignal(data.callerId, 'busy', { reason: 'user_busy' });
                            this.currentCallId = tempCallId; // Restore
                            return;
                        }

                        this.incomingCallData = { id: change.doc.id, ...data };
                        this.activeCallType = data.type || 'audio';
                        this.isOutgoingCall = false; // I am receiving this call
                        this.isGroupCall = (data.participants?.length || 0) > 2; // More than 2 total = group
                        this.currentCallId = change.doc.id;
                        // Subscribe immediately to catch Early Media/Candidates
                        this.subscribeToSignals(this.currentCallId!);
                        this.callStatus.next('incoming');

                        // Clear system notifications to prevent double UI (Modal + Banner)
                        this.pushService.clearNotifications();

                        // Play ringtone for incoming call
                        this.soundService.playRingtone();

                        // 60s timeout - auto-decline if not answered (WhatsApp behavior)
                        this.ringtoneTimeout = setTimeout(() => {
                            if (this.callStatus.value === 'incoming') {
                                this.logger.log('[Call] Ringtone timeout - marking as missed');
                                this.callEndReason = 'missed';
                                this.cleanup(); // This stops ringtone and resets state
                            }
                        }, 60000);
                    }
                } else if (change.type === 'modified') {
                    // Handle Remote Termination via Document Update
                    const data: any = change.doc.data();
                    if (change.doc.id === this.currentCallId) {
                        if (data.status === 'ended') {
                            this.logger.log("[Call] Remote call ended via document update");
                            if (this.callStatus.value === 'incoming') {
                                this.callEndReason = 'missed'; // Caller cancelled?
                            } else {
                                this.callEndReason = 'completed';
                            }
                            this.cleanup();
                        } else if (data.status === 'connected' && this.callStatus.value === 'incoming') {
                            this.logger.log("[Call] Call answered on another device");
                            this.callEndReason = 'completed'; // Or 'answered_elsewhere' if UI supports it
                            this.cleanup(); // Stop ringing
                        }
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
        // 2. We should subscribe to signals *immediately* here to buffer candidates/offers?
        //    YES.
        this.logger.log("[CallService] Init complete. Listening for calls...");

        // Safety Halt: Ensure ringtone stops if status changes from incoming
        this.callStatus.subscribe(s => {
            if (s !== 'incoming') {
                this.soundService.stopRingtone();
            }
        });
    }

    // --- Actions ---

    async startGroupCall(participantIds: string[], type: 'audio' | 'video' = 'audio') {
        const myId = localStorage.getItem('user_id');
        if (!myId) return;

        if (participantIds.length > 31) { // 31 others + me = 32
            this.logger.error("Call Limit Exceeded");
            throw new Error("Group Call Limit: Max 32 Participants");
        }

        // Scalability: Enforce Audio-Only for groups > 4 to save bandwidth/CPU
        if (participantIds.length > 3) {
            this.logger.log("[Call] Large group detected. Enforcing Audio-Only mode.");
            type = 'audio';
        }

        this.activeCallType = type;
        this.isOutgoingCall = true; // I am initiating this call
        this.isGroupCall = participantIds.length > 1; // More than 1 other participant = group call
        await this.getMedia(type);

        if (type === 'audio') {
            // Delay to ensure audio focus is settled before switching to earpiece
            setTimeout(() => {
                this.toggleSpeaker(false);
            }, 500);
        }

        // 1. Create Call Doc (The Room)
        const callDocRef = this.firestoreDoc(this.firestoreCollection(this.db, 'calls'));
        this.currentCallId = callDocRef.id;

        const allParticipants = [myId, ...participantIds];

        if (participantIds.length === 1) {
            this.otherPeerId = participantIds[0];
        }

        await this.firestoreSetDoc(callDocRef, {
            id: this.currentCallId,
            callerId: myId,
            participants: allParticipants,
            type: type,
            status: 'offer', // Initial state
            created_at: Date.now()
        });

        // 2. Subscribe to Signaling
        this.subscribeToSignals(this.currentCallId!);

        // 3. Initiate Connections to ALL participants
        // In Mesh, the Caller offers to everyone else.
        this.callStatus.next('calling');

        // Play ringback tone (caller hears ringing while waiting for receiver)
        this.soundService.playRingbackTone();

        // 60s timeout - auto-end if no answer (WhatsApp behavior)
        this.ringbackTimeout = setTimeout(() => {
            if (this.callStatus.value === 'calling') {
                this.logger.log('[Call] Ringback timeout - no answer');
                this.cleanup();
            }
        }, 60000);

        // Parallel: Connection Init & Push Notification
        // Optimization: Batch connection creation to prevent CPU freeze on large groups
        const chunk = (arr: any[], size: number) =>
            Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
                arr.slice(i * size, i * size + size)
            );

        const batches = chunk(participantIds, 5); // Connect to 5 peers at a time

        for (const batch of batches) {
            const promises = batch.map(async (peerId: string) => {
                // A. WebRTC Connection
                await this.initiatePeerConnection(peerId, this.currentCallId!);

                // B. Push Notification (Wake up the device)
                // Backend 'push.php' now handles multicasting to all user devices.
                await this.pushService.sendPush(
                    peerId,
                    'Incoming Call',
                    'Tap to answer',
                    {
                        type: 'call_invite',
                        callId: this.currentCallId,
                        callerId: myId,
                        callType: type,
                        content_available: 1, // iOS VOIP Wake
                        priority: 'high'      // Android High Priority
                    }
                );
            });
            await Promise.all(promises);
            // Small delay between batches to let CPU breathe
            await new Promise(r => setTimeout(r, 200));
        }
    }

    /**
     * Security Verification: Checks active connection stats to verify Encryption (DTLS-SRTP)
     */
    async getEncryptionStats(peerId: string): Promise<{ encrypted: boolean, cipher: string }> {
        const peer = this.peers.get(peerId);
        if (!peer || !peer.connection) return { encrypted: false, cipher: 'none' };

        try {
            const stats = await peer.connection.getStats();
            let encrypted = false;
            let cipher = 'unknown';

            stats.forEach((report: any) => {
                // Check Transport stats or Candidate Pair
                if (report.type === 'transport') {
                    // dtlsState should be 'connected'
                    if (report.dtlsState === 'connected') {
                        encrypted = true;
                        cipher = report.srtpCipher || 'DTLS-SRTP'; // Some browsers might prompt specific cipher
                    }
                }
                // Fallback: check certificate
                if (report.type === 'certificate') {
                    // If we have a certificate, we are likely secure
                }
            });

            // Standard WebRTC state check
            if (peer.connection.connectionState === 'connected' || peer.connection.iceConnectionState === 'connected') {
                // WebRTC mandates encryption. If connected, it's encrypted.
                encrypted = true;
            }

            return { encrypted, cipher };

        } catch (e) {
            this.logger.error(`[Call] Failed to get stats for ${peerId}`, e);
            return { encrypted: false, cipher: 'error' };
        }
    }

    async answerCall() {
        if (!this.incomingCallData || !this.currentCallId) return;
        const myId = localStorage.getItem('user_id');
        if (!myId) return;

        const callId = this.currentCallId;

        // Clear timeout and stop ringtone immediately when answering
        if (this.ringtoneTimeout) {
            clearTimeout(this.ringtoneTimeout);
            this.ringtoneTimeout = null;
        }
        this.soundService.stopRingtone();

        await this.getMedia(this.activeCallType);

        if (this.activeCallType === 'audio') {
            // Delay to ensure audio focus is settled
            setTimeout(() => {
                this.toggleSpeaker(false);
            }, 500);
        }
        this.callStatus.next('connected');
        this.callStartTime = Date.now();

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
        // If we are receiving a call and reject it, that's a "Decline"
        if (this.callStatus.value === 'incoming') {
            await this.declineCall();
            return;
        }

        const callId = this.currentCallId;

        // Send 'end' signal to all connected peers
        if (callId) {
            const promises: Promise<void>[] = [];
            this.peers.forEach((_, peerId) => {
                promises.push(this.sendSignal(peerId, 'end', { reason: 'user_hangup' }));
            });

            // ALSO update the main Call Document status to 'ended' (Reliable Fallback)
            const callDocRef = this.firestoreDoc(this.firestoreCollection(this.db, 'calls'), callId);
            promises.push(this.firestoreUpdateDoc(callDocRef, {
                status: 'ended',
                ended_at: Date.now()
            }));

            await Promise.all(promises).catch(e => this.logger.error("End call signals/update failed", e));
            this.logger.log("[Call] End signals sent to all peers & Doc updated");
        }

        // If I was calling and I ended it, it's a 'cancelled' call (if not yet connected)
        // If I was connected, it's 'completed'
        if (this.callStatus.value === 'calling') {
            this.callEndReason = 'cancelled';
        } else if (this.callStatus.value === 'connected') {
            this.callEndReason = 'completed';
        }

        this.cleanup();
    }

    // Decline incoming call - sends signal to caller (WhatsApp behavior)
    async declineCall() {
        if (!this.incomingCallData || (this.callStatus.value !== 'incoming' && this.callStatus.value !== 'busy')) {
            this.cleanup();
            return;
        }

        const callerId = this.incomingCallData.callerId;
        if (callerId && this.currentCallId) {
            // Send 'declined' signal to the caller
            await this.sendSignal(callerId, 'declined', { reason: 'user_declined' });
            this.callEndReason = 'declined';
            this.logger.log("[Call] Declined signal sent to caller:", callerId);
        }

        this.cleanup();
    }


    // --- Signaling & Mesh Logic ---

    private subscribeToSignals(callId: string) {
        const myId = localStorage.getItem('user_id');
        const signalsRef = this.firestoreCollection(this.db, 'calls', callId, 'signals');
        // Listen for signals meant for ME
        const q = this.firestoreQuery(signalsRef, where('to', '==', myId));

        this.signalUnsub = this.firestoreOnSnapshot(q, async (snapshot) => {
            snapshot.docChanges().forEach(async (change: any) => {
                if (change.type === 'added') {
                    const data: any = change.doc.data();
                    await this.handleSignal(data);
                }
            });
        });
    }

    private async handleSignal(data: any) {
        // BUFFERING: If we are in 'incoming' state (haven't answered yet), buffer the signal.
        // EXCEPT for 'end' signal - we must process it to stop ringing!
        if (this.callStatus.value === 'incoming' && data.type !== 'end') {
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

                // Caller: Transition to connected when we receive an answer
                if (this.callStatus.value === 'calling') {
                    this.logger.log("[Call] Answer received, transitioning to connected");
                    this.soundService.stopRingbackTone(); // Stop caller-side ringing
                    this.callStatus.next('connected');
                    this.callStartTime = Date.now();

                    // Enforce Earpiece for Audio Calls (Redundant check)
                    if (this.activeCallType === 'audio') {
                        setTimeout(() => this.toggleSpeaker(false), 500);
                    }
                }
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

        // 4. END - Other party hung up
        else if (data.type === 'end') {
            this.logger.log("[Call] Received end signal from peer:", remotePeerId);

            // If caller hangs up while we are ringing, it's a Missed Call
            if (this.callStatus.value === 'incoming') {
                this.callEndReason = 'missed';
            }

            this.cleanup();
        }

        // 5. DECLINED - Receiver declined the call (WhatsApp behavior)
        else if (data.type === 'declined') {
            this.logger.log("[Call] Call was declined by:", remotePeerId);
            // Caller hears this - stop ringback and cleanup
            this.soundService.stopRingbackTone();
            this.callEndReason = 'declined';
            this.callStatus.next('declined');
            setTimeout(() => this.cleanup(), 2000); // Wait 2s to show in UI
        }

        // 6. BUSY - Receiver is already on another call (WhatsApp behavior)
        else if (data.type === 'busy') {
            this.logger.log("[Call] User is busy:", remotePeerId);
            // Caller hears this - stop ringback and cleanup
            this.soundService.stopRingbackTone();
            this.soundService.playBusyTone();
            this.callEndReason = 'busy';
            this.callStatus.next('busy');
            setTimeout(() => this.cleanup(), 2000); // Wait 2s to show in UI
        }

        // 7. HOLD - Other party put us on hold
        else if (data.type === 'hold') {
            this.logger.log("[Call] Peer put us on hold:", remotePeerId);
            this.isOnHold.next(data.payload.hold);
            // Mute their tracks locally if they put us on hold? 
            // In WhatsApp, you hear "hold" music or silence.
            this.remoteStreams.value.get(remotePeerId)?.getTracks().forEach(t => t.enabled = !data.payload.hold);
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

        // Encryption Verification Hook
        pc.oniceconnectionstatechange = async () => {
            if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
                const stats = await this.getEncryptionStats(peerId);
                if (stats.encrypted) {
                    this.logger.log(`[Call] Secure Connection Verified with ${peerId} (${stats.cipher})`);
                } else {
                    this.logger.error(`[Call] INSECURE Connection detected with ${peerId}!`);
                }
            }
        };

        // Store
        this.peers.set(peerId, { connection: pc, candidateBuffer: [] });
        return pc;
    }

    private async sendSignal(to: string, type: 'offer' | 'answer' | 'candidate' | 'end' | 'declined' | 'busy' | 'hold', payload: any) {
        if (!this.currentCallId) return;
        const myId = localStorage.getItem('user_id');
        const signalsRef = this.firestoreCollection(this.db, 'calls', this.currentCallId, 'signals');
        await this.firestoreAddDoc(signalsRef, {
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
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
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

    async toggleSpeaker(enableSpeaker: boolean) {
        this.logger.log("[Call] Toggling speaker to:", enableSpeaker);
        try {
            if (enableSpeaker) {
                await AudioToggle.enable();
            } else {
                await AudioToggle.disable();
            }
        } catch (e) {
            this.logger.error("Native Speaker Toggle Error", e);
        }
    }



    public isOnHold = new BehaviorSubject<boolean>(false);

    toggleHold(hold: boolean) {
        this.isOnHold.next(hold);
        this.logger.log("[Call] Toggling hold:", hold);

        // Local: Mute/Unmute
        this.localStream.value?.getTracks().forEach(t => t.enabled = !hold);

        // Notify others
        if (this.currentCallId) {
            this.peers.forEach((_, peerId) => {
                this.sendSignal(peerId, 'hold', { hold: hold });
            });
        }
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
                const sender = p.connection.getSenders().find((s: any) => s.track?.kind === 'video');
                if (sender) sender.replaceTrack(newTrack);
            });

        } catch (e) {
            this.logger.error("Switch Camera Error", e);
        }
    }

    private cleanup() {
        // Stop all sounds
        this.soundService.stopRingtone();
        this.soundService.stopRingbackTone();
        this.soundService.playCallEndTone(); // Short beep when call ends

        // Clear notifications (e.g. "Incoming Call")
        this.pushService.clearNotifications();


        // Clear all timeouts
        if (this.ringtoneTimeout) {
            clearTimeout(this.ringtoneTimeout);
            this.ringtoneTimeout = null;
        }
        if (this.ringbackTimeout) {
            clearTimeout(this.ringbackTimeout);
            this.ringbackTimeout = null;
        }

        this.localStream.value?.getTracks().forEach(t => t.stop());

        // Update Call Document (for History)
        if (this.currentCallId && this.callEndReason) {
            const callRef = this.firestoreDoc(this.db, 'calls', this.currentCallId);
            updateDoc(callRef, {
                status: this.callEndReason,
                ended_at: Date.now(),
                duration: this.callStartTime > 0 ? (Date.now() - this.callStartTime) : 0
            }).catch(e => console.error("Failed to update call history", e));
        }

        // Close all peers
        this.peers.forEach(p => p.connection.close());
        this.peers.clear();

        this.localStream.next(null);
        this.remoteStreams.next(new Map());
        this.callStatus.next('idle');
        this.isOutgoingCall = false;
        this.isGroupCall = false;
        this.incomingCallData = null;
        this.otherPeerId = null;
        this.currentCallId = null;
        this.callStartTime = 0;

        if (this.signalUnsub) this.signalUnsub();
        if (this.callDocUnsub) { /* Don't stop listening for invites? */ }
        // actually we want to keep listening for invites, but maybe reset specific listeners
        this.signalUnsub = null;
    }

    getCallHistory(): any {
        const myId = localStorage.getItem('user_id');
        if (!myId) return Promise.resolve([]);

        const callsRef = this.firestoreCollection(this.db, 'calls');
        const q = this.firestoreQuery(callsRef, where('participants', 'array-contains', myId));

        return from(this.firestoreGetDocs(q).then(snap => {
            return snap.docs.map(d => {
                const data: any = d.data();
                return {
                    id: d.id,
                    ...(data as any),
                    // Map generic fields to what UI expects
                    caller_id: (data as any)['callerId'] || (data as any)['caller_id'],
                    created_at: (data as any)['created_at'] || Date.now()
                };
            }).sort((a: any, b: any) => b.created_at - a.created_at);
        }).catch(e => {
            this.logger.error("Get Call History Failed", e);
            return [];
        }));
    }

    async getCallerInfo(userId: string): Promise<{ username: string, photo: string }> {
        if (!userId) return { username: 'Unknown', photo: '' };
        try {
            const userDoc = await this.firestoreGetDoc(this.firestoreDoc(this.db, 'users', userId));
            if (userDoc.exists()) {
                const data = userDoc.data();
                return {
                    username: (data as any)['username'] || 'Unknown',
                    photo: (data as any)['photo_url'] || (data as any)['avatar'] || ''
                };
            }
        } catch (e) {
            this.logger.error("Failed to fetch caller info", e);
        }
        return { username: 'Unknown', photo: '' };
    }

    // Helpers for testing
    public async firestoreSetDoc(ref: any, data: any) {
        return await setDoc(ref, data);
    }

    public async firestoreAddDoc(ref: any, data: any) {
        return await addDoc(ref, data);
    }

    public async firestoreUpdateDoc(ref: any, data: any) {
        return await updateDoc(ref, data);
    }

    public async firestoreGetDoc(ref: any) {
        return await getDoc(ref);
    }

    public async firestoreGetDocs(q: any) {
        return await getDocs(q);
    }

    public firestoreOnSnapshot(ref: any, callback: (snap: any) => void) {
        return onSnapshot(ref, callback);
    }

    public firestoreCollection(ref: any, ...paths: string[]) {
        return (collection as any)(ref, ...paths);
    }

    public firestoreDoc(ref: any, ...paths: string[]) {
        return (doc as any)(ref, ...paths);
    }

    public firestoreQuery(q: any, ...constraints: any[]) {
        return (query as any)(q, ...constraints);
    }
}
