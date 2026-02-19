/**
 * Audio Handler for Desktop Agent
 * 
 * Handles:
 * - Microphone capture for WebRTC
 * - Speaker playback from WebRTC
 * - Audio device enumeration and selection
 */

import { AudioConfig, AudioData } from '@desktop-mcp/shared';

export interface AudioDeviceInfo {
  id: string;
  name: string;
  type: 'input' | 'output';
  isDefault: boolean;
}

export interface AudioHandlerOptions {
  inputDevice?: string;
  outputDevice?: string;
  sampleRate?: number;
  channels?: number;
  bitRate?: number;
}

export class AudioHandler {
  private audioContext: AudioContext | null = null;
  private microphoneStream: MediaStream | null = null;
  private speakerGain: GainNode | null = null;
  private isRecording = false;
  private isPlaybackReady = false;
  private options: Required<AudioHandlerOptions>;

  // Event handlers
  private onAudioData?: (data: AudioData) => void;
  private onError?: (error: Error) => void;

  constructor(options: AudioHandlerOptions = {}) {
    this.options = {
      inputDevice: options.inputDevice || 'default',
      outputDevice: options.outputDevice || 'default',
      sampleRate: options.sampleRate || 48000,
      channels: options.channels || 2,
      bitRate: options.bitRate || 128000
    };

    this.initializeAudioContext();
  }

  private async initializeAudioContext(): Promise<void> {
    try {
      // Initialize Web Audio API context
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: this.options.sampleRate,
        latencyHint: 'interactive'
      });

      // Create gain node for volume control
      this.speakerGain = this.audioContext.createGain();
      this.speakerGain.connect(this.audioContext.destination);

      console.log('🔊 Audio context initialized');
    } catch (error) {
      console.error('❌ Failed to initialize audio context:', error);
      this.onError?.(error instanceof Error ? error : new Error('Audio initialization failed'));
    }
  }

  /**
   * Start microphone capture
   */
  async startMicrophoneCapture(): Promise<MediaStreamTrack | null> {
    if (this.isRecording) {
      console.warn('⚠️ Microphone capture already active');
      return null;
    }

    try {
      console.log('🎤 Starting microphone capture...');

      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: this.options.inputDevice !== 'default' ? { exact: this.options.inputDevice } : undefined,
          sampleRate: this.options.sampleRate,
          channelCount: this.options.channels,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      };

      this.microphoneStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.isRecording = true;

      // Set up audio processing
      if (this.audioContext && this.onAudioData) {
        this.setupAudioProcessing(this.microphoneStream);
      }

      const audioTrack = this.microphoneStream.getAudioTracks()[0];
      console.log(`✅ Microphone capture started: ${audioTrack.label}`);
      
      return audioTrack;

    } catch (error) {
      console.error('❌ Failed to start microphone capture:', error);
      this.onError?.(error instanceof Error ? error : new Error('Microphone access failed'));
      return null;
    }
  }

  /**
   * Stop microphone capture
   */
  stopMicrophoneCapture(): void {
    if (!this.isRecording) return;

    console.log('🛑 Stopping microphone capture...');
    
    if (this.microphoneStream) {
      this.microphoneStream.getTracks().forEach(track => {
        track.stop();
      });
      this.microphoneStream = null;
    }

    this.isRecording = false;
    console.log('✅ Microphone capture stopped');
  }

  /**
   * Setup audio processing for data extraction
   */
  private setupAudioProcessing(stream: MediaStream): void {
    if (!this.audioContext) return;

    try {
      const source = this.audioContext.createMediaStreamSource(stream);
      const processor = this.audioContext.createScriptProcessor(4096, this.options.channels, this.options.channels);

      processor.onaudioprocess = (event) => {
        if (!this.onAudioData || !this.isRecording) return;

        // Extract audio data
        const inputBuffer = event.inputBuffer;
        const audioData = this.extractAudioData(inputBuffer);
        
        if (audioData) {
          this.onAudioData(audioData);
        }
      };

      source.connect(processor);
      processor.connect(this.audioContext.destination);

    } catch (error) {
      console.error('❌ Error setting up audio processing:', error);
    }
  }

  /**
   * Extract audio data from buffer
   */
  private extractAudioData(buffer: AudioBuffer): AudioData | null {
    try {
      const channels = [];
      for (let i = 0; i < buffer.numberOfChannels; i++) {
        channels.push(buffer.getChannelData(i));
      }

      // Convert to interleaved PCM
      const length = buffer.length * buffer.numberOfChannels;
      const pcmData = new Float32Array(length);
      
      for (let i = 0; i < buffer.length; i++) {
        for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
          pcmData[i * buffer.numberOfChannels + ch] = channels[ch][i];
        }
      }

      // Convert to ArrayBuffer
      const arrayBuffer = pcmData.buffer.slice(pcmData.byteOffset, pcmData.byteOffset + pcmData.byteLength);

      return {
        timestamp: Date.now(),
        data: arrayBuffer,
        duration: buffer.duration,
        format: {
          sampleRate: buffer.sampleRate,
          channels: buffer.numberOfChannels,
          codec: 'pcm'
        }
      };

    } catch (error) {
      console.error('❌ Error extracting audio data:', error);
      return null;
    }
  }

  /**
   * Play audio data through speakers
   */
  async playAudio(audioData: AudioData): Promise<void> {
    if (!this.audioContext || !this.speakerGain) {
      throw new Error('Audio context not initialized');
    }

    try {
      let audioBuffer: AudioBuffer;

      if (audioData.data instanceof ArrayBuffer) {
        // Decode PCM data
        audioBuffer = await this.decodePCMAudio(audioData.data, audioData.format);
      } else {
        // Assume base64 encoded audio
        const binaryData = atob(audioData.data);
        const arrayBuffer = new ArrayBuffer(binaryData.length);
        const uint8Array = new Uint8Array(arrayBuffer);
        
        for (let i = 0; i < binaryData.length; i++) {
          uint8Array[i] = binaryData.charCodeAt(i);
        }

        audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      }

      // Play the audio
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.speakerGain);
      source.start();

      console.log(`🔊 Playing audio: ${audioData.duration}s`);

    } catch (error) {
      console.error('❌ Error playing audio:', error);
      throw error;
    }
  }

  /**
   * Decode PCM audio data to AudioBuffer
   */
  private async decodePCMAudio(data: ArrayBuffer, format: AudioConfig): Promise<AudioBuffer> {
    if (!this.audioContext) {
      throw new Error('Audio context not available');
    }

    const audioBuffer = this.audioContext.createBuffer(
      format.channels,
      data.byteLength / (format.channels * 4), // Assuming 32-bit float
      format.sampleRate
    );

    // Convert ArrayBuffer to Float32Array and copy to AudioBuffer
    const floatData = new Float32Array(data);
    
    for (let ch = 0; ch < format.channels; ch++) {
      const channelData = audioBuffer.getChannelData(ch);
      for (let i = 0; i < channelData.length; i++) {
        channelData[i] = floatData[i * format.channels + ch];
      }
    }

    return audioBuffer;
  }

  /**
   * Get available audio devices
   */
  async getAudioDevices(): Promise<AudioDeviceInfo[]> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      return devices
        .filter(device => device.kind === 'audioinput' || device.kind === 'audiooutput')
        .map(device => ({
          id: device.deviceId,
          name: device.label || `${device.kind} (${device.deviceId.slice(0, 8)})`,
          type: device.kind === 'audioinput' ? 'input' : 'output',
          isDefault: device.deviceId === 'default'
        }));

    } catch (error) {
      console.error('❌ Error getting audio devices:', error);
      return [];
    }
  }

  /**
   * Set audio devices
   */
  async setAudioDevices(inputDevice?: string, outputDevice?: string): Promise<void> {
    if (inputDevice) {
      this.options.inputDevice = inputDevice;
      
      // Restart microphone capture if active
      if (this.isRecording) {
        this.stopMicrophoneCapture();
        await this.startMicrophoneCapture();
      }
    }

    if (outputDevice) {
      this.options.outputDevice = outputDevice;
      // Note: Changing output device requires browser API support
      console.log(`🔊 Output device set to: ${outputDevice}`);
    }
  }

  /**
   * Set volume level (0.0 - 1.0)
   */
  setVolume(level: number): void {
    if (this.speakerGain) {
      const clampedLevel = Math.max(0, Math.min(1, level));
      this.speakerGain.gain.setValueAtTime(clampedLevel, this.audioContext?.currentTime || 0);
      console.log(`🔊 Volume set to: ${Math.round(clampedLevel * 100)}%`);
    }
  }

  /**
   * Get current volume level
   */
  getVolume(): number {
    return this.speakerGain?.gain.value || 0;
  }

  /**
   * Event handler setters
   */
  onData(handler: (data: AudioData) => void): void {
    this.onAudioData = handler;
  }

  onErrorHandler(handler: (error: Error) => void): void {
    this.onError = handler;
  }

  /**
   * Check if microphone is active
   */
  isMicrophoneActive(): boolean {
    return this.isRecording;
  }

  /**
   * Get current audio configuration
   */
  getAudioConfig(): AudioConfig {
    return {
      sampleRate: this.options.sampleRate,
      channels: this.options.channels,
      bitRate: this.options.bitRate,
      codec: 'pcm'
    };
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    console.log('🧹 Cleaning up audio handler...');
    
    this.stopMicrophoneCapture();
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.speakerGain = null;
  }
}