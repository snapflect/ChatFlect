import { Injectable } from '@angular/core';
import { VoiceRecorder } from 'capacitor-voice-recorder';
import { LoggingService } from './logging.service';

@Injectable({
  providedIn: 'root'
})
export class RecordingService {

  constructor(private logger: LoggingService) { }

  async canRecord() {
    try {
      return await VoiceRecorder.canDeviceVoiceRecord();
    } catch (e) {
      this.logger.error("Check Record Support Failed", e);
      return { value: false };
    }
  }

  async hasPermission() {
    try {
      const status = await VoiceRecorder.hasAudioRecordingPermission();
      return status.value;
    } catch (e) {
      this.logger.error("Check Record Permission Failed", e);
      return false;
    }
  }

  async requestPermission() {
    try {
      const status = await VoiceRecorder.requestAudioRecordingPermission();
      return status.value;
    } catch (e) {
      this.logger.error("Request Record Permission Failed", e);
      return false;
    }
  }

  async startRecording() {
    try {
      return await VoiceRecorder.startRecording();
    } catch (e) {
      this.logger.error("Start Recording Failed", e);
      throw e;
    }
  }

  async stopRecording() {
    try {
      return await VoiceRecorder.stopRecording();
    } catch (e) {
      this.logger.error("Stop Recording Failed", e);
      throw e;
    }
  }

  /**
   * v15.3 Hardened Stop: Idempotent and safe.
   * NEVER throws. NEVER trusts native outcome alone.
   */
  async safeStopRecording(): Promise<{ ok: boolean; value?: any }> {
    try {
      const state = await (VoiceRecorder as any).getCurrentRecorderState();

      // R1: Native state is authoritative
      if (state?.status !== 'RECORDING') {
        return { ok: true }; // Already stopped or idle
      }

      // R2: Standardized stop without exceptional retries
      const result = await VoiceRecorder.stopRecording();
      return { ok: true, value: result?.value };
    } catch (e) {
      // R5: Native failures are NOT exceptional
      this.logger.warn("[Recording] safeStopRecording caught an expected native glitch", e);
      return { ok: false };
    }
  }

  async getCurrentStatus(): Promise<'RECORDING' | 'STOPPED' | 'NONE' | 'UNKNOWN'> {
    try {
      const state = await (VoiceRecorder as any).getCurrentRecorderState();
      return (state?.status as any) || 'UNKNOWN';
    } catch {
      return 'UNKNOWN';
    }
  }
}
