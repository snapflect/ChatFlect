import { Component, ElementRef, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild } from '@angular/core';
import { SecureMediaService } from 'src/app/services/secure-media.service';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-audio-waveform',
    template: `
        <div class="waveform-container" (click)="togglePlay()">
            <canvas #waveformCanvas class="waveform-canvas"></canvas>
            <div class="progress-overlay" [style.width.%]="progressPercent"></div>
            <div class="play-icon" *ngIf="!isPlaying">
                <ion-icon name="play"></ion-icon>
            </div>
            <div class="pause-icon" *ngIf="isPlaying">
                <ion-icon name="pause"></ion-icon>
            </div>
        </div>
        <div class="waveform-time">
            <span>{{ formatTime(currentTime) }}</span>
            <span>{{ formatTime(duration) }}</span>
        </div>
    `,
    styles: [`
        .waveform-container {
            position: relative;
            width: 200px;
            height: 40px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            overflow: hidden;
            cursor: pointer;
        }
        .waveform-canvas {
            width: 100%;
            height: 100%;
        }
        .progress-overlay {
            position: absolute;
            top: 0;
            left: 0;
            height: 100%;
            background: rgba(var(--ion-color-primary-rgb), 0.3);
            pointer-events: none;
        }
        .play-icon, .pause-icon {
            position: absolute;
            left: 10px;
            top: 50%;
            transform: translateY(-50%);
            font-size: 20px;
            color: var(--ion-color-primary);
        }
        .waveform-time {
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            color: rgba(255, 255, 255, 0.6);
            margin-top: 4px;
            padding: 0 4px;
        }
    `],
    standalone: false
})
export class AudioWaveformComponent implements OnChanges, OnDestroy {
    @Input() audioUrl: string = '';
    @Input() audioKey: string = ''; // For decryption if needed
    @Input() audioIv: string = '';
    @Input() audioMime: string = '';

    @ViewChild('waveformCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

    private audio: HTMLAudioElement | null = null;
    private audioContext: AudioContext | null = null;
    private analyser: AnalyserNode | null = null;
    private animationId: number | null = null;
    private sub: Subscription | null = null;

    constructor(private secureMedia: SecureMediaService) { }

    isPlaying = false;
    currentTime = 0;
    duration = 0;
    progressPercent = 0;

    ngOnChanges(changes: SimpleChanges) {
        if (changes['audioUrl'] && this.audioUrl) {
            this.setupAudio();
        }
    }

    setupAudio() {
        if (this.sub) {
            this.sub.unsubscribe();
            this.sub = null;
        }

        // Use SecureMediaService to decrypt/resolve URL
        this.sub = this.secureMedia.getMedia(this.audioUrl, this.audioKey, this.audioIv, this.audioMime).subscribe(
            (blobUrl) => {
                if (this.audio) {
                    this.audio.pause();
                    this.audio = null;
                }

                this.audio = new Audio(blobUrl);
                this.audio.addEventListener('loadedmetadata', () => {
                    if (isFinite(this.audio!.duration)) {
                        this.duration = this.audio!.duration;
                    }
                    this.drawStaticWaveform();
                });
                this.audio.addEventListener('timeupdate', () => {
                    this.currentTime = this.audio!.currentTime;
                    if (this.duration > 0) {
                        this.progressPercent = (this.currentTime / this.duration) * 100;
                    }
                });
                this.audio.addEventListener('ended', () => {
                    this.isPlaying = false;
                    this.progressPercent = 0;
                    this.currentTime = 0;
                });
            },
            (err) => {
                console.error("Audio Load Failed", err);
            }
        );
    }

    drawStaticWaveform() {
        const canvas = this.canvasRef.nativeElement;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const width = canvas.width = canvas.offsetWidth * 2;
        const height = canvas.height = canvas.offsetHeight * 2;
        ctx.scale(2, 2);

        const barWidth = 3;
        const gap = 2;
        const numBars = Math.floor(canvas.offsetWidth / (barWidth + gap));

        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';

        // Draw pseudo-random waveform bars
        for (let i = 0; i < numBars; i++) {
            const x = i * (barWidth + gap) + 30; // Offset for play button
            const barHeight = Math.random() * (height / 3) + 5;
            const y = (height / 2 - barHeight) / 2;
            ctx.fillRect(x, y, barWidth, barHeight);
        }
    }

    togglePlay() {
        if (!this.audio) return;

        if (this.isPlaying) {
            this.audio.pause();
        } else {
            this.audio.play();
        }
        this.isPlaying = !this.isPlaying;
    }

    formatTime(seconds: number): string {
        if (!seconds || isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    ngOnDestroy() {
        if (this.sub) this.sub.unsubscribe();
        if (this.audio) {
            this.audio.pause();
            this.audio = null;
        }
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
    }
}
