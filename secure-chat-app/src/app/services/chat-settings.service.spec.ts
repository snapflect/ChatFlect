import { TestBed } from '@angular/core/testing';
import { ChatSettingsService, ChatSettings } from './chat-settings.service';
import { LoggingService } from './logging.service';

describe('ChatSettingsService', () => {
    let service: ChatSettingsService;
    let loggerSpy: jasmine.SpyObj<LoggingService>;

    beforeEach(() => {
        loggerSpy = jasmine.createSpyObj('LoggingService', ['log', 'error']);

        TestBed.configureTestingModule({
            providers: [
                ChatSettingsService,
                { provide: LoggingService, useValue: loggerSpy }
            ]
        });

        service = TestBed.inject(ChatSettingsService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    describe('getSettings', () => {
        it('should return default settings for unknown chat', () => {
            const settings = service.getSettings('unknown_chat');

            expect(settings.pinned).toBe(false);
            expect(settings.muted).toBe(0);
            expect(settings.archived).toBe(false);
        });
    });

    describe('isPinned', () => {
        it('should return false for unpinned chat', () => {
            expect(service.isPinned('chat_123')).toBe(false);
        });
    });

    describe('isMuted', () => {
        it('should return false when muted is 0', () => {
            expect(service.isMuted('chat_123')).toBe(false);
        });

        it('should return true when muted is -1 (forever)', () => {
            // Simulate cached settings
            (service as any).settingsCache.set('chat_muted', { pinned: false, muted: -1, archived: false });
            expect(service.isMuted('chat_muted')).toBe(true);
        });

        it('should return false when mute has expired', () => {
            const pastTime = Date.now() - 10000; // 10 seconds ago
            (service as any).settingsCache.set('chat_expired', { pinned: false, muted: pastTime, archived: false });
            expect(service.isMuted('chat_expired')).toBe(false);
        });

        it('should return true when mute has not expired', () => {
            const futureTime = Date.now() + 100000; // 100 seconds from now
            (service as any).settingsCache.set('chat_active', { pinned: false, muted: futureTime, archived: false });
            expect(service.isMuted('chat_active')).toBe(true);
        });
    });

    describe('isArchived', () => {
        it('should return false for non-archived chat', () => {
            expect(service.isArchived('chat_123')).toBe(false);
        });

        it('should return true for archived chat', () => {
            (service as any).settingsCache.set('chat_archived', { pinned: false, muted: 0, archived: true });
            expect(service.isArchived('chat_archived')).toBe(true);
        });
    });
});
