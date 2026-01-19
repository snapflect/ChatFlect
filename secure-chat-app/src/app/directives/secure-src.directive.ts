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
    selector: '[secureSrc]',
    standalone: false
})
export class SecureSrcDirective implements OnChanges, OnDestroy {

    @Input('secureSrc') src: string | null = null;
    @Input('pymKey') key?: string;
    @Input('pymIv') iv?: string;

    private sub: Subscription | null = null;
    private resolvedUrl: string | null = null;

    constructor(
        private el: ElementRef<HTMLImageElement>,
        private renderer: Renderer2,
        private mediaService: SecureMediaService
    ) { }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['src'] || changes['key'] || changes['iv']) {
            this.load();
        }
    }

    private load(): void {
        this.cancel();

        // Reset UI immediately (important for DOM reuse)
        this.setSrc('assets/placeholder_user.png');
        this.setOpacity('0.5');

        if (!this.src || typeof this.src !== 'string') {
            this.setOpacity('1');
            return;
        }

        this.sub = this.mediaService.getMedia(this.src, this.key, this.iv).subscribe({
            next: (url: string) => {
                // Revoke previously resolved object URL
                if (this.resolvedUrl && this.resolvedUrl !== url) {
                    this.mediaService.revokeObjectUrl(this.resolvedUrl);
                }

                this.resolvedUrl = url;
                this.setSrc(url);
                this.setOpacity('1');
            },
            error: () => {
                this.setSrc('assets/placeholder_broken.png');
                this.setOpacity('1');
            }
        });
    }

    private setSrc(url: string): void {
        this.renderer.setAttribute(this.el.nativeElement, 'src', url);
    }

    private setOpacity(value: string): void {
        this.renderer.setStyle(this.el.nativeElement, 'opacity', value);
    }

    private cancel(): void {
        if (this.sub) {
            this.sub.unsubscribe();
            this.sub = null;
        }
    }

    ngOnDestroy(): void {
        this.cancel();
        // Do NOT revoke object URL here. 
        // usage is shared via Service Cache. 
        // Service manages revocation.
    }
}
