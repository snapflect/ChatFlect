import { TestBed } from '@angular/core/testing';
import { FormatTextPipe } from './format-text-pipe';
import { DomSanitizer } from '@angular/platform-browser';

describe('FormatTextPipe', () => {
    let pipe: FormatTextPipe;
    let sanitizerSpy: jasmine.SpyObj<DomSanitizer>;

    beforeEach(() => {
        sanitizerSpy = jasmine.createSpyObj('DomSanitizer', ['bypassSecurityTrustHtml']);
        sanitizerSpy.bypassSecurityTrustHtml.and.callFake(html => html as any);

        TestBed.configureTestingModule({
            providers: [
                FormatTextPipe,
                { provide: DomSanitizer, useValue: sanitizerSpy }
            ]
        });
        pipe = TestBed.inject(FormatTextPipe);
    });

    it('should create an instance', () => {
        expect(pipe).toBeTruthy();
    });

    it('should format bold text', () => {
        const res = pipe.transform('hello *world*');
        expect(res).toContain('<b>world</b>');
    });

    it('should format italic text', () => {
        const res = pipe.transform('hello _world_');
        expect(res).toContain('<i>world</i>');
    });

    it('should format strikethrough text', () => {
        const res = pipe.transform('hello ~world~');
        expect(res).toContain('<s>world</s>');
    });

    it('should format links', () => {
        const res = pipe.transform('visit https://google.com');
        expect(res).toContain('<a href="https://google.com"');
    });

    it('should handle multi-line text', () => {
        const res = pipe.transform('line1\nline2');
        expect(res).toContain('line1<br>line2');
    });

    it('should sanitize basic html characters', () => {
        const res = pipe.transform('<b>not bold</b>');
        expect(res).toContain('&lt;b&gt;not bold&lt;/b&gt;');
    });
});
