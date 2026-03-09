import {
    Directive,
    Input,
    ElementRef,
    OnChanges,
    SimpleChanges,
    OnDestroy,
    Renderer2
} from '@angular/core';
import { SecureMediaService } from '../services/secure-media.service';
import { Subscription } from 'rxjs';

@Directive({
    selector: '[appSecureSrc]',
    standalone: false
})
export class SecureSrcDirective implements OnChanges, OnDestroy {

    @Input() appSecureSrc: string | null = null;
    @Input() pymKey?: string;
    @Input() pymIv?: string;
    @Input() pymHash?: string;
    @Input() pymSize?: number;
    @Input() pymMime?: string;
    @Input() thumb?: string; // v15 Progressive

    private sub: Subscription | null = null;
    private resolvedUrl: string | null = null;

    constructor(
        private el: ElementRef<HTMLImageElement | HTMLVideoElement>,
        private renderer: Renderer2,
        private mediaService: SecureMediaService
    ) { }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['appSecureSrc'] || changes['pymKey'] || changes['pymIv'] || changes['thumb'] || changes['pymHash']) {
            this.load();
        }
    }

    private load(): void {
        console.log(`[SecureSrcDirective] Loading URL: ${this.appSecureSrc}`);
        this.cancel();

        // 1. Progressive Loading: Show Thumbnail immediately if available
        const isVideo = this.el.nativeElement.tagName.toLowerCase() === 'video';

        if (this.thumb && !isVideo) {
            this.setSrc(this.thumb);
            this.setBlur('10px');
            this.setOpacity('1');
        } else {
            // Default placeholder
            if (!isVideo) {
                this.setSrc('assets/placeholder_user.png');
            }
            this.setOpacity('0.5');
            this.setBlur('0px');
        }

        if (!this.appSecureSrc || typeof this.appSecureSrc !== 'string') {
            this.setOpacity('1');
            this.setBlur('0px');
            return;
        }

        // v15.2: Synchronous skip for External/Unencrypted URLs
        // This prevents "flicker" and NotReadableError issues for public resources
        const isExternal = this.appSecureSrc.startsWith('http') && !this.pymKey;
        if (isExternal) {
            this.setSrc(this.appSecureSrc);
            this.setOpacity('1');
            this.setBlur('0px');
            return;
        }

        // 2. Fetch High-Res
        const integrity = (this.pymHash || this.pymSize) ? { hash: this.pymHash || '', size: this.pymSize || 0 } : undefined;
        this.sub = this.mediaService.getMedia(this.appSecureSrc, this.pymKey, this.pymIv, this.pymMime, integrity).subscribe({
            next: (url: string) => {
                // Revoke previously resolved object URL usage (v8)
                if (this.resolvedUrl && this.resolvedUrl !== url) {
                    this.mediaService.releaseMedia(this.resolvedUrl);
                }

                this.resolvedUrl = url;
                this.setSrc(url);

                // 3. Transition: Fade in and remove blur
                this.setOpacity('1');
                this.setBlur('0px');
                this.renderer.setStyle(this.el.nativeElement, 'transition', 'filter 0.3s ease-out, opacity 0.3s ease-out');
            },
            error: () => {
                if (!isVideo) {
                    this.setSrc('assets/placeholder_broken.png');
                }
                this.setOpacity('1');
                this.setBlur('0px');
            }
        });
    }

    private setSrc(url: string): void {
        this.renderer.setAttribute(this.el.nativeElement, 'src', url);
    }

    private setOpacity(value: string): void {
        this.renderer.setStyle(this.el.nativeElement, 'opacity', value);
    }

    private setBlur(value: string): void {
        this.renderer.setStyle(this.el.nativeElement, 'filter', `blur(${value})`);
    }

    private cancel(): void {
        if (this.sub) {
            this.sub.unsubscribe();
            this.sub = null;
        }
    }

    ngOnDestroy(): void {
        this.cancel();
        // v8 Deep GC: Release usage of the media URL
        if (this.resolvedUrl) {
            this.mediaService.releaseMedia(this.resolvedUrl);
            this.resolvedUrl = null;
        }
    }
}
