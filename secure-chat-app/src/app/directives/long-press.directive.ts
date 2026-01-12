import { Directive, ElementRef, EventEmitter, HostListener, OnDestroy, Output } from '@angular/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

@Directive({
    selector: '[longPress]',
    standalone: false
})
export class LongPressDirective implements OnDestroy {
    @Output() longPress = new EventEmitter();
    private timer?: any;
    private isPressing = false;
    private touchStartX = 0;
    private touchStartY = 0;

    constructor() { }

    @HostListener('touchstart', ['$event'])
    onStart(ev: any) {
        // Only handle single touch
        if (ev.touches && ev.touches.length > 1) return;

        this.isPressing = true;
        this.touchStartX = ev.touches[0].clientX;
        this.touchStartY = ev.touches[0].clientY;
        this.startTimer();
    }

    @HostListener('touchmove', ['$event'])
    onMove(ev: any) {
        if (!this.isPressing) return;

        const x = ev.touches[0].clientX;
        const y = ev.touches[0].clientY;

        // If moved more than 15px in any direction, it's a scroll or swipe
        if (Math.abs(x - this.touchStartX) > 15 || Math.abs(y - this.touchStartY) > 15) {
            this.clearTimer();
        }
    }

    @HostListener('touchend')
    @HostListener('touchcancel')
    onEnd() {
        this.clearTimer();
    }

    // Support for desktop/web testing
    @HostListener('mousedown', ['$event'])
    onMouseDown(ev: MouseEvent) {
        this.isPressing = true;
        this.startTimer();
    }

    @HostListener('mouseup')
    @HostListener('mouseleave')
    onMouseUp() {
        this.clearTimer();
    }

    private startTimer() {
        if (this.timer) clearTimeout(this.timer);
        this.timer = setTimeout(async () => {
            if (this.isPressing) {
                this.longPress.emit();
                try {
                    await Haptics.impact({ style: ImpactStyle.Medium });
                } catch (e) {
                    // Ignore haptic failures
                }
            }
        }, 500); // 500ms threshold for long press
    }

    private clearTimer() {
        this.isPressing = false;
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = undefined;
        }
    }

    ngOnDestroy() {
        this.clearTimer();
    }
}
