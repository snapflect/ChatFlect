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
}
