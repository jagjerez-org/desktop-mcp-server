/**
 * WebRTC Peer for Desktop Agent
 * 
 * Handles:
 * - WebRTC peer connection with MCP server
 * - Sending video/audio streams to server
 * - Receiving input commands via DataChannel
 * - Connection state management
 */

import { RTCPeerConnection, RTCDataChannel, RTCIceCandidate, RTCSessionDescription } from './wrtc-stub.js';
import { 
  CommandMessage, 
  ResponseMessage, 
  ProtocolMessage,
  ProtocolValidator,
  RTCConnectionInfo,
  ConnectionStatus
} from '@desktop-mcp/shared';
import { ScreenCapture } from './screen-capture.js';
import { AudioHandler } from './audio.js';
import { InputHandler } from './input-handler.js';

export interface WebRTCPeerOptions {
  iceServers?: RTCIceServer[];
  maxBitrate?: number;
  maxFramerate?: number;
}

export class WebRTCPeer {
  private peerConnection: RTCPeerConnection;
  private dataChannel: RTCDataChannel | null = null;
  private responseChannel: RTCDataChannel | null = null;
  private screenCapture: ScreenCapture;
  private audioHandler: AudioHandler;
  private inputHandler: InputHandler;
  private isConnected = false;
  private deviceId: string;

  // Event handlers
  private onConnectionStateChange?: (state: RTCConnectionInfo) => void;
  private onIceCandidate?: (candidate: RTCIceCandidate) => void;
  private onError?: (error: Error) => void;

  constructor(deviceId: string, options: WebRTCPeerOptions = {}) {
    this.deviceId = deviceId;
    
    const config: RTCConfiguration = {
      iceServers: options.iceServers || [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    this.peerConnection = new RTCPeerConnection(config);
    this.screenCapture = new ScreenCapture({
      frameRate: options.maxFramerate || 30,
      maxWidth: 1920,
      maxHeight: 1080
    });
    this.audioHandler = new AudioHandler();
    this.inputHandler = new InputHandler();

    this.setupPeerConnection();
    this.setupEventHandlers();
  }

  private setupPeerConnection(): void {
    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('🧊 Generated ICE candidate');
        this.onIceCandidate?.(event.candidate);
      }
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.getConnectionState();
      console.log(`🔗 Connection state: ${state.connectionState}`);
      
      this.isConnected = state.connectionState === 'connected';
      this.onConnectionStateChange?.(state);
      
      if (state.connectionState === 'failed' || state.connectionState === 'disconnected') {
        this.handleDisconnection();
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('🧊 ICE connection state:', this.peerConnection.iceConnectionState);
    };

    this.peerConnection.onsignalingstatechange = () => {
      console.log('📡 Signaling state:', this.peerConnection.signalingState);
    };

    // Handle incoming data channels
    this.peerConnection.ondatachannel = (event) => {
      const channel = event.channel;
      console.log(`📡 Received data channel: ${channel.label}`);
      
      if (channel.label === 'commands') {
        this.setupCommandChannel(channel);
      }
    };

    // Create response data channel
    this.responseChannel = this.peerConnection.createDataChannel('responses', {
      ordered: true,
      maxRetransmits: 3
    });
    this.setupResponseChannel(this.responseChannel);
  }

  private setupEventHandlers(): void {
    // Handle audio data from microphone
    this.audioHandler.onData((audioData) => {
      // In a real implementation, this would be sent via WebRTC audio track
      console.log('🎤 Audio data captured');
    });

    this.audioHandler.onErrorHandler((error) => {
      console.error('❌ Audio error:', error);
      this.onError?.(error);
    });
  }

  private setupCommandChannel(channel: RTCDataChannel): void {
    this.dataChannel = channel;

    channel.onopen = () => {
      console.log('📡 Command channel opened');
    };

    channel.onclose = () => {
      console.log('📡 Command channel closed');
    };

    channel.onmessage = async (event) => {
      try {
        const message: ProtocolMessage = JSON.parse(event.data);
        
        if (!ProtocolValidator.isValidMessage(message)) {
          console.error('❌ Invalid message format');
          return;
        }

        if (message.type === 'ping') {
          // Respond to ping with pong
          this.sendResponse({
            type: 'pong',
            timestamp: Date.now()
          });
          return;
        }

        if (ProtocolValidator.isCommandMessage(message)) {
          // Handle command
          const response = await this.inputHandler.handleCommand(message);
          this.sendResponse(response);
        }

      } catch (error) {
        console.error('❌ Error handling data channel message:', error);
        
        const errorResponse = {
          type: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: Date.now()
        };
        this.sendResponse(errorResponse);
      }
    };

    channel.onerror = (error) => {
      console.error('❌ Command channel error:', error);
    };
  }

  private setupResponseChannel(channel: RTCDataChannel): void {
    channel.onopen = () => {
      console.log('📡 Response channel opened');
    };

    channel.onclose = () => {
      console.log('📡 Response channel closed');
    };

    channel.onerror = (error) => {
      console.error('❌ Response channel error:', error);
    };
  }

  /**
   * Start media streams (screen capture and audio)
   */
  async startMediaStreams(): Promise<void> {
    try {
      console.log('🎥 Starting media streams...');

      // Start screen capture
      const videoTrack = await this.screenCapture.startCapture();
      if (videoTrack) {
        // Add video track to peer connection
        this.peerConnection.addTrack(videoTrack);
        console.log('✅ Video track added to peer connection');
      }

      // Start microphone capture
      const audioTrack = await this.audioHandler.startMicrophoneCapture();
      if (audioTrack) {
        // Add audio track to peer connection
        this.peerConnection.addTrack(audioTrack);
        console.log('✅ Audio track added to peer connection');
      }

    } catch (error) {
      console.error('❌ Error starting media streams:', error);
      throw error;
    }
  }

  /**
   * Stop media streams
   */
  stopMediaStreams(): void {
    console.log('🛑 Stopping media streams...');
    
    this.screenCapture.stopCapture();
    this.audioHandler.stopMicrophoneCapture();
    
    // Remove tracks from peer connection
    const senders = this.peerConnection.getSenders();
    senders.forEach(sender => {
      if (sender.track) {
        this.peerConnection.removeTrack(sender);
      }
    });
  }

  /**
   * Create WebRTC answer
   */
  async createAnswer(offer: RTCSessionDescription): Promise<RTCSessionDescription> {
    await this.peerConnection.setRemoteDescription(offer);
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    return answer;
  }

  /**
   * Handle ICE candidate from server
   */
  async handleIceCandidate(candidate: RTCIceCandidate): Promise<void> {
    await this.peerConnection.addIceCandidate(candidate);
  }

  /**
   * Send response message via data channel
   */
  private sendResponse(response: ResponseMessage | any): boolean {
    if (!this.responseChannel || this.responseChannel.readyState !== 'open') {
      console.warn('⚠️ Response channel not ready');
      return false;
    }

    try {
      this.responseChannel.send(JSON.stringify(response));
      return true;
    } catch (error) {
      console.error('❌ Error sending response:', error);
      return false;
    }
  }

  /**
   * Handle disconnection
   */
  private handleDisconnection(): void {
    console.log('🔌 Handling disconnection...');
    this.stopMediaStreams();
  }

  /**
   * Get connection status
   */
  getStatus(): ConnectionStatus {
    return {
      isConnected: this.isConnected,
      resolution: this.screenCapture.isActive() ? {
        width: 1920, // Would get from actual capture
        height: 1080
      } : undefined,
      frameRate: this.screenCapture.isActive() ? 30 : undefined,
      lastActivity: Date.now()
    };
  }

  /**
   * Get WebRTC connection state
   */
  getConnectionState(): RTCConnectionInfo {
    return {
      connectionState: this.peerConnection.connectionState,
      iceConnectionState: this.peerConnection.iceConnectionState,
      signalingState: this.peerConnection.signalingState,
      localDescription: this.peerConnection.localDescription,
      remoteDescription: this.peerConnection.remoteDescription
    };
  }

  /**
   * Get screen information
   */
  async getScreenInfo() {
    return this.inputHandler.getScreenInfo();
  }

  /**
   * Get available audio devices
   */
  async getAudioDevices() {
    return this.audioHandler.getAudioDevices();
  }

  /**
   * Set audio devices
   */
  async setAudioDevices(inputDevice?: string, outputDevice?: string) {
    return this.audioHandler.setAudioDevices(inputDevice, outputDevice);
  }

  /**
   * Set volume level
   */
  setVolume(level: number): void {
    this.audioHandler.setVolume(level);
  }

  /**
   * Event handler setters
   */
  onConnect(handler: (state: RTCConnectionInfo) => void): void {
    this.onConnectionStateChange = handler;
  }

  onIce(handler: (candidate: RTCIceCandidate) => void): void {
    this.onIceCandidate = handler;
  }

  onErrorHandler(handler: (error: Error) => void): void {
    this.onError = handler;
  }

  /**
   * Close the WebRTC connection
   */
  close(): void {
    console.log('🔌 Closing WebRTC peer connection...');
    
    this.stopMediaStreams();
    
    if (this.dataChannel) {
      this.dataChannel.close();
    }
    
    if (this.responseChannel) {
      this.responseChannel.close();
    }
    
    this.peerConnection.close();
    this.audioHandler.dispose();
    
    this.isConnected = false;
    console.log('✅ WebRTC peer connection closed');
  }
}