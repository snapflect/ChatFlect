import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BackupPage } from './backup.page';
import { BackupService } from '../../services/backup.service';
import { IonicModule, ToastController, AlertController, LoadingController } from '@ionic/angular';

describe('BackupPage', () => {
    let component: BackupPage;
    let fixture: ComponentFixture<BackupPage>;
    let backupServiceSpy: jasmine.SpyObj<BackupService>;

    beforeEach(async () => {
        backupServiceSpy = jasmine.createSpyObj('BackupService', ['createBackup', 'restoreBackup']);

        await TestBed.configureTestingModule({
            declarations: [BackupPage],
            imports: [IonicModule.forRoot()],
            providers: [
                { provide: BackupService, useValue: backupServiceSpy },
                { provide: ToastController, useValue: jasmine.createSpyObj('ToastController', { create: Promise.resolve({ present: () => Promise.resolve() }) }) },
                { provide: AlertController, useValue: jasmine.createSpyObj('AlertController', { create: Promise.resolve({ present: () => Promise.resolve() }) }) },
                { provide: LoadingController, useValue: jasmine.createSpyObj('LoadingController', { create: Promise.resolve({ present: () => Promise.resolve(), dismiss: () => Promise.resolve() }) }) }
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(BackupPage);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should call createBackup on service when triggered', async () => {
        const mockBlob = new Blob(['{}'], { type: 'application/json' });
        backupServiceSpy.createBackup.and.returnValue(Promise.resolve(mockBlob));
        const loadingSpy = TestBed.inject(LoadingController) as any;
        loadingSpy.create.and.returnValue(Promise.resolve({ present: () => Promise.resolve(), dismiss: () => Promise.resolve() }));

        // Mock downloadBlob to avoid actual file download during test
        spyOn(component, 'downloadBlob');

        await component.createBackup();

        expect(backupServiceSpy.createBackup).toHaveBeenCalled();
    });
});
