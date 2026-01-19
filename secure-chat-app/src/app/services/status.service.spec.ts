import { TestBed } from '@angular/core/testing';
import { StatusService } from './status.service';
import { ApiService } from './api.service';
import { of } from 'rxjs';

describe('StatusService', () => {
    let service: StatusService;
    let apiServiceSpy: jasmine.SpyObj<ApiService>;

    beforeEach(() => {
        apiServiceSpy = jasmine.createSpyObj('ApiService', ['get', 'post']);
        apiServiceSpy.get.and.returnValue(of([]));
        apiServiceSpy.post.and.returnValue(of({ status: 'success' }));

        TestBed.configureTestingModule({
            providers: [
                StatusService,
                { provide: ApiService, useValue: apiServiceSpy }
            ]
        });
        service = TestBed.inject(StatusService);

        // Mock localStorage
        spyOn(localStorage, 'getItem').and.callFake((key: string) => {
            if (key === 'user_id') return 'test-user-id';
            if (key === 'viewed_status_ids') return '[]';
            if (key === 'muted_status_users') return '[]';
            return null;
        });
        spyOn(localStorage, 'setItem');
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should get feed', () => {
        service.getFeed('test-user').subscribe();
        expect(apiServiceSpy.get).toHaveBeenCalledWith('status.php?action=feed&user_id=test-user');
    });

    it('should upload media status', () => {
        const file = new File([''], 'test.jpg', { type: 'image/jpeg' });
        service.uploadStatus(file, 'test caption', 'image', 'everyone').subscribe();
        expect(apiServiceSpy.post).toHaveBeenCalledWith('status.php', jasmine.any(FormData));
    });

    it('should upload text status', () => {
        service.uploadTextStatus('Hello', '#FF0000', 'sans-serif', 'everyone').subscribe();
        expect(apiServiceSpy.post).toHaveBeenCalledWith('status.php', jasmine.any(FormData));
    });

    it('should record view', () => {
        service.recordView('123').subscribe();
        expect(apiServiceSpy.post).toHaveBeenCalledWith('status.php?action=view', jasmine.any(Object));
    });

    it('should get viewers', () => {
        service.getViewers('123').subscribe();
        expect(apiServiceSpy.get).toHaveBeenCalledWith('status.php?action=viewers&status_id=123');
    });

    it('should delete status', () => {
        service.deleteStatus('123').subscribe();
        expect(apiServiceSpy.post).toHaveBeenCalledWith('status.php?action=delete', jasmine.any(Object));
    });

    it('should mute user', (done) => {
        service.muteUser('user-to-mute', true).subscribe(() => {
            expect(apiServiceSpy.post).toHaveBeenCalledWith('status.php?action=mute', jasmine.any(Object));
            done();
        });
    });

    it('should track viewed status locally', () => {
        service.markAsViewed('status-123');
        expect(localStorage.setItem).toHaveBeenCalled();
    });

    it('should check if status is viewed', () => {
        expect(service.isViewed('some-id')).toBeFalse(); // Empty array from mock
    });
});
