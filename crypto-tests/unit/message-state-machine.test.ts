/**
 * Unit Tests for Message State Machine Service
 * Epic 11: Messaging State Machine Core
 */

import { MessageState, MessageStateMachineService, STATE_NAMES } from '../mocks/message-state-machine.service';

describe('MessageStateMachineService', () => {
    let service: MessageStateMachineService;

    beforeEach(() => {
        service = new MessageStateMachineService();
    });

    // ===========================================
    // State Transition Guards
    // ===========================================
    describe('canTransition', () => {
        it('should allow CREATED -> ENCRYPTED', () => {
            expect(service.canTransition(MessageState.CREATED, MessageState.ENCRYPTED)).toBe(true);
        });

        it('should allow CREATED -> FAILED', () => {
            expect(service.canTransition(MessageState.CREATED, MessageState.FAILED)).toBe(true);
        });

        it('should BLOCK CREATED -> SENT', () => {
            expect(service.canTransition(MessageState.CREATED, MessageState.SENT)).toBe(false);
        });

        it('should BLOCK CREATED -> DELIVERED', () => {
            expect(service.canTransition(MessageState.CREATED, MessageState.DELIVERED)).toBe(false);
        });

        it('should allow QUEUED -> SENT', () => {
            expect(service.canTransition(MessageState.QUEUED, MessageState.SENT)).toBe(true);
        });

        it('should allow FAILED -> REPAIRED', () => {
            expect(service.canTransition(MessageState.FAILED, MessageState.REPAIRED)).toBe(true);
        });

        it('should BLOCK READ -> any (terminal state)', () => {
            expect(service.canTransition(MessageState.READ, MessageState.CREATED)).toBe(false);
            expect(service.canTransition(MessageState.READ, MessageState.SENT)).toBe(false);
            expect(service.canTransition(MessageState.READ, MessageState.FAILED)).toBe(false);
        });
    });

    // ===========================================
    // State Initialization
    // ===========================================
    describe('initializeState', () => {
        it('should create new message in CREATED state', () => {
            const record = service.initializeState('msg_001');

            expect(record.messageId).toBe('msg_001');
            expect(record.state).toBe(MessageState.CREATED);
            expect(record.stateVersion).toBe(1);
            expect(record.retryCount).toBe(0);
            expect(record.lastError).toBeNull();
        });
    });

    // ===========================================
    // Apply Transition
    // ===========================================
    describe('applyTransition', () => {
        it('should successfully transition CREATED -> ENCRYPTED', () => {
            service.initializeState('msg_002');

            const result = service.applyTransition('msg_002', MessageState.ENCRYPTED);

            expect(result.success).toBe(true);
            expect(result.record?.state).toBe(MessageState.ENCRYPTED);
            expect(result.record?.stateVersion).toBe(2);
        });

        it('should reject invalid transition CREATED -> DELIVERED', () => {
            service.initializeState('msg_003');

            const result = service.applyTransition('msg_003', MessageState.DELIVERED);

            expect(result.success).toBe(false);
            expect(result.error).toContain('not allowed');
        });

        it('should increment retry_count on FAILED transition', () => {
            service.initializeState('msg_004');
            service.applyTransition('msg_004', MessageState.FAILED, 'Network error');

            const record = service.getState('msg_004');

            expect(record?.state).toBe(MessageState.FAILED);
            expect(record?.retryCount).toBe(1);
            expect(record?.lastError).toBe('Network error');
        });

        it('should return error for unknown messageId', () => {
            const result = service.applyTransition('unknown_msg', MessageState.SENT);

            expect(result.success).toBe(false);
            expect(result.error).toContain('not found');
        });
    });

    // ===========================================
    // Full Pipeline Test
    // ===========================================
    describe('Full Pipeline', () => {
        it('should complete full lifecycle: CREATED -> READ', () => {
            service.initializeState('msg_full');

            // CREATED -> ENCRYPTED
            let result = service.applyTransition('msg_full', MessageState.ENCRYPTED);
            expect(result.success).toBe(true);

            // ENCRYPTED -> QUEUED
            result = service.applyTransition('msg_full', MessageState.QUEUED);
            expect(result.success).toBe(true);

            // QUEUED -> SENT
            result = service.applyTransition('msg_full', MessageState.SENT);
            expect(result.success).toBe(true);

            // SENT -> DELIVERED
            result = service.applyTransition('msg_full', MessageState.DELIVERED);
            expect(result.success).toBe(true);

            // DELIVERED -> READ
            result = service.applyTransition('msg_full', MessageState.READ);
            expect(result.success).toBe(true);

            const finalRecord = service.getState('msg_full');
            expect(finalRecord?.state).toBe(MessageState.READ);
            expect(finalRecord?.stateVersion).toBe(6); // 1 init + 5 transitions
        });
    });

    // ===========================================
    // Retry Flow
    // ===========================================
    describe('Retry Flow', () => {
        it('should allow FAILED -> REPAIRED -> SENT', () => {
            service.initializeState('msg_retry');

            // Go to FAILED
            service.applyTransition('msg_retry', MessageState.ENCRYPTED);
            service.applyTransition('msg_retry', MessageState.QUEUED);
            service.applyTransition('msg_retry', MessageState.FAILED, 'Timeout');

            expect(service.getState('msg_retry')?.retryCount).toBe(1);

            // Repair and resend
            let result = service.applyTransition('msg_retry', MessageState.REPAIRED);
            expect(result.success).toBe(true);

            result = service.applyTransition('msg_retry', MessageState.SENT);
            expect(result.success).toBe(true);
        });
    });

    // ===========================================
    // Get Failed Messages
    // ===========================================
    describe('getFailedMessages', () => {
        it('should return failed messages under retry limit', () => {
            service.initializeState('msg_f1');
            service.applyTransition('msg_f1', MessageState.FAILED, 'Error');

            service.initializeState('msg_f2');
            service.applyTransition('msg_f2', MessageState.ENCRYPTED);

            const failed = service.getFailedMessages(3);

            expect(failed.length).toBe(1);
            expect(failed[0].messageId).toBe('msg_f1');
        });
    });
});
