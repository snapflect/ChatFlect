import { Component, ElementRef, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild } from '@angular/core';
import { SecureMediaService } from 'src/app/services/secure-media.service';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-audio-waveform',
    template: `
        <div class="audio-player-container">
            <!-- Play/Pause Button -->
            <div class="control-btn" (click)="togglePlay($event)">
                <ion-icon [name]="isPlaying ? 'pause' : 'play'"></ion-icon>
            </div>

            <!-- Waveform Tracker -->
            <div class="waveform-track" (click)="seekTo($event)">
                <canvas #waveformCanvas class="waveform-canvas"></canvas>
                <div class="progress-overlay" [style.width.%]="progressPercent"></div>
            </div>
        </div>
        <div class="waveform-time">
            <span>{{ formatTime(currentTime) }}</span>
            <span>{{ formatTime(duration) }}</span>
        </div>
    `,
    styles: [`
        .audio-player-container {
            display: flex;
            align-items: center;
            width: 220px;
            height: 40px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            padding: 0 4px;
        }
        .control-btn {
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 50%;
            margin-right: 8px;
            cursor: pointer;
            flex-shrink: 0;
            color: var(--ion-color-primary, #3880ff);
        }
        .waveform-track {
            position: relative;
            flex-grow: 1;
            height: 30px;
            cursor: pointer;
            overflow: hidden;
            border-radius: 4px;
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
            background: rgba(var(--ion-color-primary-rgb, 56, 128, 255), 0.3);
            pointer-events: none;
            transition: width 0.1s linear;
        }
        .waveform-time {
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            color: rgba(255, 255, 255, 0.6);
            margin-top: 4px;
            padding: 0 8px;
            width: 220px;
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

        console.log('[AudioWaveform] setupAudio called with:', {
            url: this.audioUrl,
            key: this.audioKey?.substring(0, 20) + '...',
            iv: this.audioIv?.substring(0, 20) + '...',
            mime: this.audioMime
        });

        // Use SecureMediaService to decrypt/resolve URL
        this.sub = this.secureMedia.getMedia(this.audioUrl, this.audioKey, this.audioIv, this.audioMime).subscribe(
            (blobUrl) => {
                console.log('[AudioWaveform] Got blobUrl:', blobUrl?.substring(0, 50));

                if (this.audio) {
                    this.audio.pause();
                    this.audio = null;
                }

                this.audio = new Audio(blobUrl);

                this.audio.addEventListener('loadedmetadata', () => {
                    console.log('[AudioWaveform] loadedmetadata, duration:', this.audio!.duration);
                    if (isFinite(this.audio!.duration)) {
                        this.duration = this.audio!.duration;
                    }
                    this.drawStaticWaveform();
                });

                this.audio.addEventListener('canplaythrough', () => {
                    console.log('[AudioWaveform] canplaythrough');
                });

                this.audio.addEventListener('error', (e) => {
                    console.error('[AudioWaveform] Audio error:', this.audio?.error);
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
                    if (this.animationId) cancelAnimationFrame(this.animationId);
                });
                this.audio.addEventListener('play', () => this.isPlaying = true);
                this.audio.addEventListener('pause', () => this.isPlaying = false);

                // Force load
                this.audio.load();
            },
            (err) => {
                console.error("[AudioWaveform] SecureMedia error:", err);
            }
        );
    }

    drawStaticWaveform() {
        const canvas = this.canvasRef.nativeElement;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Use parent container for dimensions or fixed relative size
        const parent = canvas.parentElement;
        const width = canvas.width = (parent?.offsetWidth || 150) * 2;
        const height = canvas.height = (parent?.offsetHeight || 30) * 2;
        ctx.scale(2, 2);

        const barWidth = 3;
        const gap = 2;
        const numBars = Math.floor((width / 2) / (barWidth + gap));

        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';

        // Draw pseudo-random waveform bars
        for (let i = 0; i < numBars; i++) {
            const x = i * (barWidth + gap);
            const barHeight = Math.random() * (height / 2) * 0.8 + 4;
            const y = (height / 4 - barHeight / 2); // Center in container
            ctx.fillRect(x, y + 8, barWidth, barHeight); // Slight offset
        }
    }

    togglePlay(event?: Event) {
        if (event) event.stopPropagation();

        if (!this.audio) {
            // Retry setup if failed first time?
            this.setupAudio();
            return;
        }

        if (this.isPlaying) {
            this.audio.pause();
            if (this.animationId) cancelAnimationFrame(this.animationId);
        } else {
            this.audio.play().catch(e => console.error("Play failed", e));
            this.animate();
        }
    }

    animate() {
        if (this.isPlaying && this.audio) {
            this.currentTime = this.audio.currentTime;
            if (this.duration > 0) {
                this.progressPercent = (this.currentTime / this.duration) * 100;
            }
            this.animationId = requestAnimationFrame(() => this.animate());
        }
    }

    seekTo(event: MouseEvent) {
        if (!this.audio || !this.duration) return;

        const track = event.currentTarget as HTMLElement;
        const rect = track.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const percent = Math.min(Math.max(x / rect.width, 0), 1);

        const newTime = percent * this.duration;
        this.audio.currentTime = newTime;

        // Update UI immediately for responsiveness
        this.currentTime = newTime;
        this.progressPercent = percent * 100;

        if (!this.isPlaying) {
            // Optional: Auto-play on seek? WhatsApp does not auto-play on scrub if paused.
        }
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
