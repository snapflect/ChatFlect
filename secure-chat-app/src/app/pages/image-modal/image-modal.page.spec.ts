import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ImageModalPage } from './image-modal.page';
import { IonicModule, ModalController, ToastController, NavController } from '@ionic/angular';
import { LoggingService } from 'src/app/services/logging.service';
import { Filesystem, Directory } from '@capacitor/filesystem';

describe('ImageModalPage', () => {
    let component: ImageModalPage;
    let fixture: ComponentFixture<ImageModalPage>;
    let modalCtrlSpy: jasmine.SpyObj<ModalController>;
    let toastCtrlSpy: jasmine.SpyObj<ToastController>;
    let loggerSpy: jasmine.SpyObj<LoggingService>;

    beforeEach(async () => {
        modalCtrlSpy = jasmine.createSpyObj('ModalController', ['dismiss']);
        toastCtrlSpy = jasmine.createSpyObj('ToastController', ['create']);
        loggerSpy = jasmine.createSpyObj('LoggingService', ['error']);

        await TestBed.configureTestingModule({
            declarations: [ImageModalPage],
            imports: [IonicModule.forRoot()],
            providers: [
                { provide: ModalController, useValue: modalCtrlSpy },
                { provide: ToastController, useValue: toastCtrlSpy },
                { provide: LoggingService, useValue: loggerSpy },
                { provide: NavController, useValue: jasmine.createSpyObj('NavController', ['navigateForward']) }
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(ImageModalPage);
        component = fixture.componentInstance;
        component.imageUrl = 'blob:http://localhost/123';
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should dismiss on close()', () => {
        component.close();
        expect(modalCtrlSpy.dismiss).toHaveBeenCalled();
    });

    it('should attempt to save image', async () => {
        // Mock fetch
        const mockBlob = new Blob([''], { type: 'image/jpeg' });
        spyOn(window, 'fetch').and.returnValue(Promise.resolve({
            blob: () => Promise.resolve(mockBlob)
        } as Response));

        // Mock Filesystem
        Object.defineProperty(Filesystem, 'writeFile', {
            value: jasmine.createSpy('writeFile').and.returnValue(Promise.resolve({ uri: 'saved_path' })),
            configurable: true
        });
        toastCtrlSpy.create.and.returnValue(Promise.resolve({ present: () => Promise.resolve() } as any));


        await component.saveImage();

        expect(Filesystem.writeFile).toHaveBeenCalled();
        expect(toastCtrlSpy.create).toHaveBeenCalled();
    });
});
