import { Component, DebugElement } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { SecureSrcDirective } from './secure-src.directive';
import { SecureMediaService } from '../services/secure-media.service';
import { of } from 'rxjs';

// Mock Service
class MockSecureMediaService {
    getMedia(url: string, key?: string, iv?: string) {
        if (url === 'valid-url') {
            return of('blob:http://localhost/valid-blob-url');
        }
        return of(null);
    }
    revokeObjectUrl(url: string) { }
}

// Test Host Component
@Component({
    template: `<img [secureSrc]="src" [pymKey]="key" [pymIv]="iv">`
})
class TestHostComponent {
    src: string | null = null;
    key?: string;
    iv?: string;
}

describe('SecureSrcDirective', () => {
    let fixture: ComponentFixture<TestHostComponent>;
    let component: TestHostComponent;
    let imgElement: DebugElement;
    let mediaService: SecureMediaService;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            declarations: [SecureSrcDirective, TestHostComponent],
            providers: [
                { provide: SecureMediaService, useClass: MockSecureMediaService }
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(TestHostComponent);
        component = fixture.componentInstance;
        imgElement = fixture.debugElement.query(By.css('img'));
        mediaService = TestBed.inject(SecureMediaService);
    });

    it('should create an instance', () => {
        const directive = imgElement.injector.get(SecureSrcDirective);
        expect(directive).toBeTruthy();
    });

    it('should set placeholder when src is null', () => {
        component.src = null;
        fixture.detectChanges();
        const img = imgElement.nativeElement as HTMLImageElement;
        expect(img.src).toContain('assets/placeholder_user.png'); // Matching implementation
    });

    it('should call getMedia and set src when secureSrc is provided', fakeAsync(() => {
        spyOn(mediaService, 'getMedia').and.callThrough();

        component.src = 'valid-url';
        fixture.detectChanges();
        tick(); // Wait for observable

        expect(mediaService.getMedia).toHaveBeenCalledWith('valid-url', undefined, undefined);
        const img = imgElement.nativeElement as HTMLImageElement;
        expect(img.src).toContain('blob:http://localhost/valid-blob-url');
    }));

    it('should pass encryption keys to service', fakeAsync(() => {
        spyOn(mediaService, 'getMedia').and.callThrough();

        component.src = 'valid-url';
        component.key = 'my-key';
        component.iv = 'my-iv';
        fixture.detectChanges();
        tick();

        expect(mediaService.getMedia).toHaveBeenCalledWith('valid-url', 'my-key', 'my-iv');
    }));

    it('should cleanup object URL on destroy', fakeAsync(() => {
        spyOn(mediaService, 'revokeObjectUrl');

        component.src = 'valid-url';
        fixture.detectChanges();
        tick();

        fixture.destroy();
        expect(mediaService.revokeObjectUrl).toHaveBeenCalledWith('blob:http://localhost/valid-blob-url');
    }));
});
