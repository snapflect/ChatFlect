import { Directive, ElementRef, EventEmitter, Output, OnInit, OnDestroy } from '@angular/core';
import { GestureController, Gesture } from '@ionic/angular';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

@Directive({
    selector: '[appSwipeToReply]',
    standalone: true
})
export class SwipeToReplyDirective implements OnInit, OnDestroy {
    @Output() reply = new EventEmitter<void>();
    private gesture: Gesture | null = null;
    private threshold = 60; // Pixels to swipe to trigger reply
    private triggered = false;

    constructor(
        private el: ElementRef,
        private gestureCtrl: GestureController
    ) { }

    ngOnInit() {
        this.initGesture();
    }

    ngOnDestroy() {
        if (this.gesture) {
            this.gesture.destroy();
        }
    }

    private initGesture() {
        this.gesture = this.gestureCtrl.create({
            el: this.el.nativeElement,
            gestureName: 'swipe-to-reply',
            threshold: 10,
            direction: 'x',
            passive: false, // v11: Allow preventDefault for scroll locking
            onMove: (ev) => this.onMove(ev),
            onEnd: (ev) => this.onEnd(ev)
        });
        this.gesture.enable(true);
    }

    private onMove(ev: any) {
        // v11: Horizontal Dominance Check
        // If vertical movement is greater than horizontal, ignore this gesture to allow scrolling.
        if (Math.abs(ev.deltaY) > Math.abs(ev.deltaX)) {
            return;
        }

        // v11: Lock Scroll if intended to swipe
        if (ev.event && typeof ev.event.preventDefault === 'function') {
            ev.event.preventDefault();
        }

        if (ev.deltaX > 0) { // Only swipe Right
            const transform = Math.min(ev.deltaX, 100); // Cap visual movement
            this.el.nativeElement.style.transform = `translateX(${transform}px)`;

            // Visual feedback threshold
            if (ev.deltaX > this.threshold && !this.triggered) {
                this.triggered = true;
                this.hapticFeedback();
            } else if (ev.deltaX < this.threshold && this.triggered) {
                this.triggered = false;
            }
        }
    }

    private onEnd(ev: any) {
        this.el.nativeElement.style.transition = 'transform 0.2s ease-out';
        this.el.nativeElement.style.transform = 'translateX(0)';

        if (this.triggered) {
            this.reply.emit();
        }

        this.triggered = false;

        // Reset transition after animation
        setTimeout(() => {
            this.el.nativeElement.style.transition = '';
        }, 200);
    }

    private async hapticFeedback() {
        try {
            await Haptics.impact({ style: ImpactStyle.Medium });
        } catch (e) {
            // Fallback or ignore if not available
        }
    }
}
