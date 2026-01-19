import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface RecordingState {
    isRecording: boolean;
    isPaused: boolean;
    duration: number;
    audioLevel: number;
}

@Injectable({
    providedIn: 'root'
})
export class VoiceRecorderService {
    private mediaRecorder: MediaRecorder | null = null;
    private audioChunks: Blob[] = [];
    private stream: MediaStream | null = null;
    private audioContext: AudioContext | null = null;
    private analyser: AnalyserNode | null = null;
    private animationFrame: number | null = null;
    private startTime: number = 0;
    private pausedDuration: number = 0;
    private timerInterval: any;

    private stateSubject = new BehaviorSubject<RecordingState>({
        isRecording: false,
        isPaused: false,
        duration: 0,
        audioLevel: 0
    });

    public state$ = this.stateSubject.asObservable();

    // Max recording duration (30 seconds like WhatsApp)
    private readonly MAX_DURATION = 30;

    constructor() { }

    async startRecording(): Promise<boolean> {
        try {
            // Request microphone permission
            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 44100
                }
            });

            // Setup audio analysis for visualizer
            this.setupAudioAnalyser();

            // Create MediaRecorder
            const mimeType = this.getSupportedMimeType();
            this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });
            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };

            this.mediaRecorder.start(100); // Collect data every 100ms
            this.startTime = Date.now();
            this.pausedDuration = 0;

            // Start duration timer
            this.startTimer();

            // Update state
            this.updateState({ isRecording: true, isPaused: false, duration: 0 });

            return true;
        } catch (error) {
            console.error('Failed to start recording:', error);
            return false;
        }
    }

    private getSupportedMimeType(): string {
        const mimeTypes = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/ogg;codecs=opus',
            'audio/mp4',
            'audio/mpeg'
        ];

        for (const mimeType of mimeTypes) {
            if (MediaRecorder.isTypeSupported(mimeType)) {
                return mimeType;
            }
        }
        return 'audio/webm'; // Fallback
    }

    private setupAudioAnalyser() {
        if (!this.stream) return;

        this.audioContext = new AudioContext();
        const source = this.audioContext.createMediaStreamSource(this.stream);
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        source.connect(this.analyser);

        this.updateAudioLevel();
    }

    private updateAudioLevel() {
        if (!this.analyser || !this.stateSubject.value.isRecording) return;

        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(dataArray);

        // Calculate average level
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        const normalizedLevel = Math.min(average / 128, 1);

        this.updateState({ audioLevel: normalizedLevel });

        this.animationFrame = requestAnimationFrame(() => this.updateAudioLevel());
    }

    private startTimer() {
        this.timerInterval = setInterval(() => {
            const currentState = this.stateSubject.value;
            if (currentState.isRecording && !currentState.isPaused) {
                const elapsed = (Date.now() - this.startTime - this.pausedDuration) / 1000;
                this.updateState({ duration: Math.floor(elapsed) });

                // Auto-stop at max duration
                if (elapsed >= this.MAX_DURATION) {
                    this.stopRecording();
                }
            }
        }, 100);
    }

    pauseRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.pause();
            this.updateState({ isPaused: true });
        }
    }

    resumeRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
            this.mediaRecorder.resume();
            this.updateState({ isPaused: false });
        }
    }

    async stopRecording(): Promise<Blob | null> {
        return new Promise((resolve) => {
            if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
                resolve(null);
                return;
            }

            this.mediaRecorder.onstop = () => {
                const mimeType = this.getSupportedMimeType();
                const audioBlob = new Blob(this.audioChunks, { type: mimeType });
                this.cleanup();
                resolve(audioBlob);
            };

            this.mediaRecorder.stop();
        });
    }

    cancelRecording() {
        this.cleanup();
    }

    private cleanup() {
        // Stop all tracks
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        // Clear animation frame
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }

        // Close audio context
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        // Clear timer
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }

        this.analyser = null;
        this.mediaRecorder = null;
        this.audioChunks = [];

        // Reset state
        this.updateState({
            isRecording: false,
            isPaused: false,
            duration: 0,
            audioLevel: 0
        });
    }

    private updateState(partial: Partial<RecordingState>) {
        this.stateSubject.next({ ...this.stateSubject.value, ...partial });
    }

    formatDuration(seconds: number): string {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    getMaxDuration(): number {
        return this.MAX_DURATION;
    }
}
