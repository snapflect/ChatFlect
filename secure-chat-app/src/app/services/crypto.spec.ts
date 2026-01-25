import { TestBed } from '@angular/core/testing';
import { CryptoService } from './crypto.service';
import { LoggingService } from './logging.service';

describe('CryptoService', () => {
  let service: CryptoService;
  let loggerSpy: jasmine.SpyObj<LoggingService>;

  beforeEach(() => {
    loggerSpy = jasmine.createSpyObj('LoggingService', ['error', 'log']);
    TestBed.configureTestingModule({
      providers: [
        CryptoService,
        { provide: LoggingService, useValue: loggerSpy }
      ]
    });
    service = TestBed.inject(CryptoService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('RSA Key Management', () => {
    it('should generate a valid RSA key pair', async () => {
      const keyPair = await service.generateKeyPair();
      expect(keyPair.publicKey).toBeDefined();
      expect(keyPair.privateKey).toBeDefined();
    });

    it('should export and import keys', async () => {
      const keyPair = await service.generateKeyPair();
      const exported = await service.exportKey(keyPair.publicKey);
      expect(typeof exported).toBe('string');
      const imported = await service.importKey(exported, 'public');
      expect(imported.type).toBe('public');
    });
  });

  describe('Phase 2: Hybrid Encryption', () => {
    it('should match Phase 2 requirements', async () => {
      const sessionKey = await service.generateSessionKey();
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const ivBase64 = service.arrayBufferToBase64(iv.buffer as ArrayBuffer);
      const text = "Secret";

      const enc = await service.encryptPayload(text, sessionKey, iv);
      const dec = await service.decryptPayload(enc, sessionKey, ivBase64);
      expect(dec).toBe(text);
    });
  });

  describe('Phase 3: Integrity', () => {
    it('should fail on tampering', async () => {
      const sessionKey = await service.generateSessionKey();
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const ivBase64 = service.arrayBufferToBase64(iv.buffer as ArrayBuffer);

      let enc = await service.encryptPayload("Integrity", sessionKey, iv);
      if (enc.length > 5) enc = 'A' + enc.substring(1); // Tamper

      try {
        await service.decryptPayload(enc, sessionKey, ivBase64);
        fail();
      } catch (e) {
        expect(e).toBeTruthy();
      }
    });
  });
});
