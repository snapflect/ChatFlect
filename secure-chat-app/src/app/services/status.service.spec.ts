import { TestBed } from '@angular/core/testing';
import { StatusService } from './status.service';
import { ApiService } from './api.service';
import { of } from 'rxjs';

describe('StatusService', () => {
    let service: StatusService;
    let apiSpy: jasmine.SpyObj<ApiService>;

    beforeEach(() => {
        apiSpy = jasmine.createSpyObj('ApiService', ['get', 'post']);

        TestBed.configureTestingModule({
            providers: [
                StatusService,
                { provide: ApiService, useValue: apiSpy }
            ]
        });
        service = TestBed.inject(StatusService);

        spyOn(localStorage, 'getItem').and.returnValue('my_id');
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should get feed', () => {
        apiSpy.get.and.returnValue(of([]));
        service.getFeed();
        expect(apiSpy.get).toHaveBeenCalledWith('status.php?action=feed');
    });

    it('should upload media status', () => {
        apiSpy.post.and.returnValue(of({}));
        const file = new File([''], 'test.png');
        service.uploadStatus(file, 'caption');

        expect(apiSpy.post).toHaveBeenCalled();
        const formData = apiSpy.post.calls.mostRecent().args[1] as FormData;
        expect(formData.get('caption')).toBe('caption');
    });

    it('should upload text status', () => {
        apiSpy.post.and.returnValue(of({}));
        service.uploadTextStatus('hello', 'red', 'roboto');

        expect(apiSpy.post).toHaveBeenCalled();
        const formData = apiSpy.post.calls.mostRecent().args[1] as FormData;
        expect(formData.get('text_content')).toBe('hello');
    });

    it('should record view', () => {
        apiSpy.post.and.returnValue(of({}));
        service.recordView('status123');
        expect(apiSpy.post).toHaveBeenCalledWith('status.php?action=view', jasmine.objectContaining({
            status_id: 'status123'
        }));
    });
});
