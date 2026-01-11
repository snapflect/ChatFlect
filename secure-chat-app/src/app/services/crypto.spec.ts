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
      expect(keyPair.publicKey.type).toBe('public');
      expect(keyPair.privateKey.type).toBe('private');
    });

    it('should export and import public keys correctly', async () => {
      const keyPair = await service.generateKeyPair();
      const exported = await service.exportKey(keyPair.publicKey);
      expect(typeof exported).toBe('string');
      expect(exported.length).toBeGreaterThan(0);

      const imported = await service.importKey(exported, 'public');
      expect(imported.type).toBe('public');
      expect(imported.extractable).toBeTrue();
    });

    it('should export and import private keys correctly', async () => {
      const keyPair = await service.generateKeyPair();
      const exported = await service.exportKey(keyPair.privateKey);
      expect(typeof exported).toBe('string');

      const imported = await service.importKey(exported, 'private');
      expect(imported.type).toBe('private');
    });
  });

  describe('Hybrid Encryption (Legacy)', () => {
    it('should encrypt and decrypt a message using RSA+AES', async () => {
      const myKeys = await service.generateKeyPair();
      const myPubKeyStr = await service.exportKey(myKeys.publicKey);
      const myPrivKeyStr = await service.exportKey(myKeys.privateKey);

      const originalText = "Hello Secure World!";
      const encryptedPkg = await service.encryptMessage(originalText, myPubKeyStr);

      expect(encryptedPkg).toContain('"k"'); // Should have encrypted key
      expect(encryptedPkg).toContain('"d"'); // Should have data

      const decryptedText = await service.decryptMessage(encryptedPkg, myPrivKeyStr);
      expect(decryptedText).toBe(originalText);
    });

    it('should fail decryption with wrong key', async () => {
      const keys1 = await service.generateKeyPair();
      const keys2 = await service.generateKeyPair();
      const pubKey1Str = await service.exportKey(keys1.publicKey);
      const privKey2Str = await service.exportKey(keys2.privateKey);

      const encrypted = await service.encryptMessage("Secret", pubKey1Str);
      const result = await service.decryptMessage(encrypted, privKey2Str);

      expect(result).toBe("[Decryption Error]");
      expect(loggerSpy.error).toHaveBeenCalled();
    });
  });

  describe('Double Ratchet Primitives', () => {
    it('should derive consistent keys via HKDF', async () => {
      const ikm = new TextEncoder().encode("input_key_material");
      const salt = new TextEncoder().encode("salt");
      const info = new TextEncoder().encode("info");

      const prk = await service.hkdfExtract(salt, ikm);
      const okm1 = await service.hkdfExpand(prk, info, 32);
      const okm2 = await service.hkdfExpand(prk, info, 32);

      expect(new Uint8Array(okm1)).toEqual(new Uint8Array(okm2));
    });

    it('should generate next chain key and message key via KDF Chain', async () => {
      const chainKey = window.crypto.getRandomValues(new Uint8Array(32));
      const result = await service.kdfChain(chainKey);

      expect(result.nextChainKey.byteLength).toBe(32);
      expect(result.messageKey.type).toBe('secret');
      expect(result.messageKey.algorithm.name).toBe('AES-GCM');
    });
  });

  describe('Full Double Ratchet Protocol', () => {
    it('should perform end-to-end ratchet encryption and decryption', async () => {
      // Mock LocalStorage for tests
      const store: any = {};
      spyOn(localStorage, 'getItem').and.callFake(key => store[key] || null);
      spyOn(localStorage, 'setItem').and.callFake((key, val) => store[key] = val);

      const aliceKeys = await service.generateKeyPair();
      const bobKeys = await service.generateKeyPair();
      const alicePubKeyStr = await service.exportKey(aliceKeys.publicKey);
      const bobPubKeyStr = await service.exportKey(bobKeys.publicKey);
      const bobPrivKeyStr = await service.exportKey(bobKeys.privateKey);

      const message1 = "Hi Bob, Alice here.";
      const message2 = "Second message from Alice.";

      // 1. Alice sends to Bob (Initiates)
      const pkg1 = await service.encryptWithRatchet(message1, 'bob', bobPubKeyStr);
      expect(pkg1).toContain('"v":2');
      expect(pkg1).toContain('"h"'); // Header should be present in 1st message

      // 2. Bob decrypts
      const decrypted1 = await service.decryptWithRatchet(pkg1, 'alice', bobPrivKeyStr);
      expect(decrypted1).toBe(message1);

      // 3. Alice sends second message (Ratchet forward)
      const pkg2 = await service.encryptWithRatchet(message2, 'bob', bobPubKeyStr);
      expect(pkg2).not.toContain('"h"'); // Subsequent messages shouldn't have bootstrap header

      const decrypted2 = await service.decryptWithRatchet(pkg2, 'alice', bobPrivKeyStr);
      expect(decrypted2).toBe(message2);
    });

    it('should fallback to legacy decryption for v1 packages', async () => {
      const myKeys = await service.generateKeyPair();
      const myPubKeyStr = await service.exportKey(myKeys.publicKey);
      const myPrivKeyStr = await service.exportKey(myKeys.privateKey);

      // Create legacy package
      const legacyPkg = await service.encryptMessage("Legacy Message", myPubKeyStr);

      // Decrypt using ratchet service
      const result = await service.decryptWithRatchet(legacyPkg, 'sender', myPrivKeyStr);
      expect(result).toBe("Legacy Message");
    });
  });

  describe('Blob Encryption', () => {
    it('should encrypt and decrypt a blob correctly', async () => {
      const originalData = new Uint8Array([1, 2, 3, 4, 5]);
      const blob = new Blob([originalData]);

      const { encryptedBlob, key, iv } = await service.encryptBlob(blob);
      expect(encryptedBlob.size).toBeGreaterThan(0);

      const decryptedBlob = await service.decryptBlob(encryptedBlob, key, iv);
      const decryptedData = new Uint8Array(await decryptedBlob.arrayBuffer());

      expect(decryptedData).toEqual(originalData);
    });
  });
});
