import { TestBed } from '@angular/core/testing';
import { BackupService } from './backup.service';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { CryptoService } from './crypto.service';

describe('BackupService', () => {
    let service: BackupService;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                BackupService,
                { provide: ApiService, useValue: {} },
                { provide: AuthService, useValue: {} },
                { provide: CryptoService, useValue: {} }
            ]
        });
        service = TestBed.inject(BackupService);

        // Mock localStorage
        spyOn(localStorage, 'getItem').and.callFake(key => {
            if (key === 'private_key') return 'priv_key';
            if (key === 'public_key') return 'pub_key';
            if (key === 'user_id') return 'u123';
            return null;
        });
        spyOn(localStorage, 'setItem');
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should create a backup blob with correct keys', async () => {
        const blob = await service.createBackup();
        expect(blob).toBeTruthy();
        expect(blob.type).toBe('application/json');

        const text = await blob.text();
        const data = JSON.parse(text);
        expect(data.keys.private_key).toBe('priv_key');
        expect(data.keys.user_id).toBe('u123');
    });

    it('should restore a backup from json string', async () => {
        const validBackup = JSON.stringify({
            keys: {
                private_key: 'new_priv',
                public_key: 'new_pub',
                user_id: 'new_u'
            }
        });

        const result = await service.restoreBackup(validBackup);
        expect(result).toBeTrue();
        expect(localStorage.setItem).toHaveBeenCalledWith('private_key', 'new_priv');
        expect(localStorage.setItem).toHaveBeenCalledWith('user_id', 'new_u');
    });

    it('should return false if backup format is invalid', async () => {
        const invalidBackup = JSON.stringify({ version: 1 }); // No keys
        const result = await service.restoreBackup(invalidBackup);
        expect(result).toBeFalse();
    });

    it('should return false if json parsing fails', async () => {
        const result = await service.restoreBackup('not recursive json');
        expect(result).toBeFalse();
    });
});
