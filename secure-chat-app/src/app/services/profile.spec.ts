import { TestBed } from '@angular/core/testing';
import { ProfileService } from './profile.service';
import { ApiService } from './api.service';
import { of } from 'rxjs';

describe('ProfileService', () => {
  let service: ProfileService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ProfileService,
        { provide: ApiService, useValue: jasmine.createSpyObj('ApiService', ['get', 'post']) }
      ]
    });
    service = TestBed.inject(ProfileService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
