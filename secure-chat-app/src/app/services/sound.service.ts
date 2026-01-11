import { Injectable } from '@angular/core';
import { LoggingService } from './logging.service';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

@Injectable({
    providedIn: 'root'
})
export class SoundService {
    private ringtoneAudio: HTMLAudioElement | null = null;
    private ringbackAudio: HTMLAudioElement | null = null; // For caller (outgoing)
    private messageAudio: HTMLAudioElement | null = null;
    private callEndAudio: HTMLAudioElement | null = null; // For call end beep
    private activeChatId: string | null = null;
    private isRingtonePlaying = false;
    private isRingbackPlaying = false;

    // Sound file URLs
    private readonly RINGTONE_URL = 'assets/sounds/ringtone.mp3';
    private readonly RINGBACK_URL = 'assets/sounds/ringback.mp3'; // Caller-side ringing
    private readonly MESSAGE_URL = 'assets/sounds/message.mp3';
    private readonly CALL_END_URL = 'assets/sounds/call_end.mp3';

    constructor(private logger: LoggingService) {
        this.initAudio();
    }

    private initAudio() {
        // Initialize audio elements
        this.ringtoneAudio = new Audio();
        this.ringtoneAudio.loop = true; // Ringtone loops until answered
        this.ringtoneAudio.src = this.RINGTONE_URL;

        // Ringback for outgoing calls (caller hears this while waiting)
        this.ringbackAudio = new Audio();
        this.ringbackAudio.loop = true; // Loops until receiver answers
        this.ringbackAudio.src = this.RINGBACK_URL;

        this.messageAudio = new Audio();
        this.messageAudio.loop = false;
        this.messageAudio.src = this.MESSAGE_URL;

        // Call end beep
        this.callEndAudio = new Audio();
        this.callEndAudio.loop = false;
        this.callEndAudio.src = this.CALL_END_URL;

        // Handle errors gracefully
        this.ringtoneAudio.onerror = () => {
            this.logger.log('[Sound] Ringtone file not found, using fallback');
            this.createFallbackRingtone();
        };

        this.ringbackAudio.onerror = () => {
            this.logger.log('[Sound] Ringback file not found, using fallback');
            this.ringbackAudio = null;
        };

        this.messageAudio.onerror = () => {
            this.logger.log('[Sound] Message sound file not found, using fallback');
            this.createFallbackMessageSound();
        };

        this.callEndAudio.onerror = () => {
            this.logger.log('[Sound] Call end sound not found');
            this.callEndAudio = null;
        };
    }

    // Create fallback sounds using Web Audio API
    private createFallbackRingtone() {
        // Create a simple beep-beep pattern using oscillator
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const duration = 0.3;
        const frequency = 440;

        const oscillator = ctx.createOscillator();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
        oscillator.connect(ctx.destination);

        // For fallback, we'll just use a simple approach
        this.ringtoneAudio = null; // Disable ringtone if no file
    }

    private createFallbackMessageSound() {
        this.messageAudio = null;
    }

    // --- Ringtone Control ---

    playRingtone(): void {
        if (this.isRingtonePlaying) return;

        try {
            if (this.ringtoneAudio) {
                // Ensure src is set (in case it was cleared)
                if (!this.ringtoneAudio.src || this.ringtoneAudio.src === '') {
                    this.ringtoneAudio.src = this.RINGTONE_URL;
                }
                this.ringtoneAudio.currentTime = 0;
                this.ringtoneAudio.play().catch(e => {
                    this.logger.error('[Sound] Failed to play ringtone:', e);
                });
                this.isRingtonePlaying = true;
                this.logger.log('[Sound] Ringtone started');
            } else {
                // Fallback: Use system vibration if available
                if (typeof navigator.vibrate === 'function') {
                    this.startVibrationPattern();
                }
            }
        } catch (e) {
            this.logger.error('[Sound] Ringtone error:', e);
        }
    }

    stopRingtone(): void {
        // Always force stop, regardless of flag
        try {
            if (this.ringtoneAudio) {
                this.ringtoneAudio.pause();
                this.ringtoneAudio.currentTime = 0;
                // Nuclear option: clear source to ensure no looping
                this.ringtoneAudio.src = '';
                this.ringtoneAudio.load(); // Release resources
            }
            this.isRingtonePlaying = false;
            this.stopVibration();
            this.logger.log('[Sound] Ringtone stopped (Nuclear)');
        } catch (e) {
            this.logger.error('[Sound] Stop ringtone error:', e);
        }
    }

    // --- Ringback Tone (Caller hears while waiting for receiver) ---

    playRingbackTone(): void {
        if (this.isRingbackPlaying) return;

        try {
            if (this.ringbackAudio) {
                this.ringbackAudio.currentTime = 0;
                this.ringbackAudio.play().catch(e => {
                    this.logger.error('[Sound] Failed to play ringback:', e);
                });
                this.isRingbackPlaying = true;
                this.logger.log('[Sound] Ringback tone started');
            }
        } catch (e) {
            this.logger.error('[Sound] Ringback error:', e);
        }
    }

    stopRingbackTone(): void {
        if (!this.isRingbackPlaying) return;

        try {
            if (this.ringbackAudio) {
                this.ringbackAudio.pause();
                this.ringbackAudio.currentTime = 0;
            }
            this.isRingbackPlaying = false;
            this.logger.log('[Sound] Ringback tone stopped');
        } catch (e) {
            this.logger.error('[Sound] Stop ringback error:', e);
        }
    }

    // --- Call End Tone ---

    playCallEndTone(): void {
        try {
            if (this.callEndAudio) {
                this.callEndAudio.currentTime = 0;
                this.callEndAudio.play().catch(e => {
                    this.logger.error('[Sound] Failed to play call end tone:', e);
                });
                this.logger.log('[Sound] Call end tone played');
            }
        } catch (e) {
            this.logger.error('[Sound] Call end tone error:', e);
        }
    }

    playBusyTone(): void {
        // WhatsApp busy tone is usually 3 short beeps
        this.logger.log('[Sound] Playing busy tone (fallback)');
        this.vibrateForMessage(); // Use vibration as fallback
        // We'll use callEnd tone for now as it's a short beep
        this.playCallEndTone();
        setTimeout(() => this.playCallEndTone(), 500);
        setTimeout(() => this.playCallEndTone(), 1000);
    }

    // Vibration fallback using Capacitor Haptics
    private vibrationInterval: any = null;

    private async startVibrationPattern(): Promise<void> {
        try {
            // Initial vibration
            await Haptics.vibrate({ duration: 500 });

            // Repeating pattern: vibrate 500ms, pause 500ms
            this.vibrationInterval = setInterval(async () => {
                try {
                    await Haptics.vibrate({ duration: 500 });
                } catch (e) {
                    // Fallback to navigator.vibrate for web
                    if (typeof navigator.vibrate === 'function') {
                        navigator.vibrate(500);
                    }
                }
            }, 1000);
        } catch (e) {
            // Fallback for web
            if (typeof navigator.vibrate === 'function') {
                this.vibrationInterval = setInterval(() => {
                    navigator.vibrate([500, 500, 500]);
                }, 1500);
            }
        }
    }

    private stopVibration(): void {
        if (this.vibrationInterval) {
            clearInterval(this.vibrationInterval);
            this.vibrationInterval = null;
        }
        if (typeof navigator.vibrate === 'function') {
            navigator.vibrate(0); // Stop vibration
        }
    }

    // Short vibration for message notifications
    private async vibrateForMessage(): Promise<void> {
        try {
            await Haptics.notification({ type: NotificationType.Success });
        } catch (e) {
            if (typeof navigator.vibrate === 'function') {
                navigator.vibrate(100);
            }
        }
    }

    // --- Message Sound ---

    playMessageSound(chatId: string): void {
        // Don't play if user is viewing this chat
        if (this.activeChatId === chatId) {
            this.logger.log('[Sound] Skipping message sound - user is in chat:', chatId);
            return;
        }

        try {
            if (this.messageAudio) {
                this.messageAudio.currentTime = 0;
                this.messageAudio.play().catch(e => {
                    this.logger.error('[Sound] Failed to play message sound:', e);
                });
                this.logger.log('[Sound] Message sound played for chat:', chatId);
            }

            // Short vibration for message using Capacitor Haptics
            this.vibrateForMessage();
        } catch (e) {
            this.logger.error('[Sound] Message sound error:', e);
        }
    }

    // --- Active Chat Tracking ---

    setActiveChat(chatId: string): void {
        this.activeChatId = chatId;
        this.logger.log('[Sound] Active chat set:', chatId);
    }

    clearActiveChat(): void {
        this.activeChatId = null;
        this.logger.log('[Sound] Active chat cleared');
    }

    getActiveChat(): string | null {
        return this.activeChatId;
    }
}
