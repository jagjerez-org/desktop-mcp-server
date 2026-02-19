/**
 * WebRTC Client for MCP Server
 * 
 * Handles the server-side WebRTC peer connection:
 * - Receives video/audio streams from desktop agent
 * - Sends input commands via DataChannel
 * - Manages connection state and stats
 */

import { RTCPeerConnection, RTCDataChannel, RTCIceCandidate, RTCSessionDescription } from './wrtc-stub.js';
import sharp from 'sharp';
import { 
  ProtocolMessage, 
  CommandMessage, 
  ResponseMessage,
  FrameCapture,
  ConnectionStatus,
  SignalingMessage,
  RTCConnectionInfo
} from '@desktop-mcp/shared';

export interface WebRTCClientOptions {
  iceServers?: RTCIceServer[];
  maxBitrate?: number;
  maxFramerate?: number;
}

export class WebRTCClient {
  private peerConnection: RTCPeerConnection;
  private dataChannel: RTCDataChannel | null = null;
  private remoteVideoTrack: MediaStreamTrack | null = null;
  private remoteAudioTrack: MediaStreamTrack | null = null;
  private deviceId: string;
  private isConnected = false;
  private latency = 0;
  private lastPingTime = 0;
  private frameBuffer: FrameCapture[] = [];
  private maxFrameBufferSize = 10;

  // Event handlers
  private onConnectionStateChange?: (state: RTCConnectionInfo) => void;
  private onDataChannelMessage?: (message: ResponseMessage) => void;
  private onVideoFrame?: (frame: FrameCapture) => void;
  private onAudioData?: (data: ArrayBuffer) => void;
  private onError?: (error: Error) => void;

  constructor(deviceId: string, options: WebRTCClientOptions = {}) {
    this.deviceId = deviceId;
    
    const config: RTCConfiguration = {
      iceServers: options.iceServers || [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    this.peerConnection = new RTCPeerConnection(config);
    this.setupPeerConnection(options);
  }

  private setupPeerConnection(options: WebRTCClientOptions): void {
    // Create data channel for commands
    this.dataChannel = this.peerConnection.createDataChannel('commands', {
      ordered: true,
      maxRetransmits: 3
    });

    this.setupDataChannel(this.dataChannel);

    // Handle incoming data channels
    this.peerConnection.ondatachannel = (event) => {
      const channel = event.channel;
      if (channel.label === 'responses') {
        this.setupDataChannel(channel);
      }
    };

    // Handle remote streams
    this.peerConnection.ontrack = (event) => {
      const track = event.track;
      console.log(`📺 Received ${track.kind} track:`, track.id);

      if (track.kind === 'video') {
        this.remoteVideoTrack = track;
        this.setupVideoCapture(track);
      } else if (track.kind === 'audio') {
        this.remoteAudioTrack = track;
        this.setupAudioCapture(track);
      }
    };

    // Connection state monitoring
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.getConnectionState();
      console.log(`🔗 Connection state changed:`, state.connectionState);
      
      this.isConnected = state.connectionState === 'connected';
      this.onConnectionStateChange?.(state);
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('🧊 ICE connection state:', this.peerConnection.iceConnectionState);
    };

    this.peerConnection.onsignalingstatechange = () => {
      console.log('📡 Signaling state:', this.peerConnection.signalingState);
    };

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      // ICE candidates will be handled by the signaling server
      console.log('🧊 Local ICE candidate generated');
    };

    // Apply bitrate and framerate constraints
    if (options.maxBitrate || options.maxFramerate) {
      this.peerConnection.ontrack = (event) => {
        const sender = this.peerConnection.getSenders().find(s => s.track === event.track);
        if (sender && event.track.kind === 'video') {
          this.applyVideoConstraints(sender, options);
        }
      };
    }
  }

  private setupDataChannel(channel: RTCDataChannel): void {
    channel.onopen = () => {
      console.log(`📡 Data channel opened: ${channel.label}`);
      
      // Start ping/pong for latency measurement
      this.startLatencyMeasurement();
    };

    channel.onclose = () => {
      console.log(`📡 Data channel closed: ${channel.label}`);
    };

    channel.onmessage = (event) => {
      try {
        const message: ProtocolMessage = JSON.parse(event.data);
        
        if (message.type === 'pong') {
          // Calculate latency
          this.latency = Date.now() - this.lastPingTime;
          return;
        }

        // Handle response messages
        this.onDataChannelMessage?.(message as ResponseMessage);
      } catch (error) {
        console.error('❌ Error parsing data channel message:', error);
      }
    };

    channel.onerror = (error) => {
      console.error(`❌ Data channel error (${channel.label}):`, error);
      this.onError?.(new Error(`Data channel error: ${error}`));
    };
  }

  private setupVideoCapture(track: MediaStreamTrack): void {
    // This is a simplified version - in practice you'd need to use 
    // canvas or WebRTC internals to capture frames
    console.log('🎥 Video capture setup for track:', track.id);
    
    // For now, we'll simulate frame capture
    // In a real implementation, you'd capture frames from the MediaStreamTrack
    setInterval(() => {
      if (this.isConnected && this.remoteVideoTrack) {
        // Simulate frame capture - in reality this would capture from the video track
        const frame: FrameCapture = {
          timestamp: Date.now(),
          data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', // 1x1 transparent PNG
          width: 1920,
          height: 1080,
          format: 'jpeg',
          quality: 80
        };
        
        this.addFrameToBuffer(frame);
        this.onVideoFrame?.(frame);
      }
    }, 100); // 10 FPS for simulation
  }

  private setupAudioCapture(track: MediaStreamTrack): void {
    console.log('🔊 Audio capture setup for track:', track.id);
    
    // Audio capture would be implemented here
    // This is complex and would require additional WebRTC internals
  }

  private addFrameToBuffer(frame: FrameCapture): void {
    this.frameBuffer.push(frame);
    
    // Keep buffer size limited
    if (this.frameBuffer.length > this.maxFrameBufferSize) {
      this.frameBuffer.shift();
    }
  }

  private startLatencyMeasurement(): void {
    setInterval(() => {
      if (this.dataChannel && this.dataChannel.readyState === 'open') {
        this.lastPingTime = Date.now();
        this.dataChannel.send(JSON.stringify({ type: 'ping', timestamp: this.lastPingTime }));
      }
    }, 5000); // Ping every 5 seconds
  }

  private async applyVideoConstraints(sender: RTCRtpSender, options: WebRTCClientOptions): Promise<void> {
    const params = sender.getParameters();
    
    if (options.maxBitrate && params.encodings[0]) {
      params.encodings[0].maxBitrate = options.maxBitrate;
    }

    await sender.setParameters(params);
  }

  /**
   * Create WebRTC offer
   */
  async createOffer(): Promise<RTCSessionDescription> {
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    return offer;
  }

  /**
   * Handle WebRTC answer from agent
   */
  async handleAnswer(answer: RTCSessionDescription): Promise<void> {
    await this.peerConnection.setRemoteDescription(answer);
  }

  /**
   * Handle ICE candidate from agent
   */
  async handleIceCandidate(candidate: RTCIceCandidate): Promise<void> {
    await this.peerConnection.addIceCandidate(candidate);
  }

  /**
   * Send command to desktop agent
   */
  sendCommand(command: CommandMessage): boolean {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      return false;
    }

    try {
      this.dataChannel.send(JSON.stringify(command));
      return true;
    } catch (error) {
      console.error('❌ Error sending command:', error);
      return false;
    }
  }

  /**
   * Get latest captured frame
   */
  getLatestFrame(): FrameCapture | null {
    return this.frameBuffer.length > 0 ? this.frameBuffer[this.frameBuffer.length - 1] : null;
  }

  /**
   * Get multiple frames from buffer
   */
  getFrames(count: number): FrameCapture[] {
    return this.frameBuffer.slice(-count);
  }

  /**
   * Convert frame to different format/quality
   */
  async convertFrame(frame: FrameCapture, format: 'jpeg' | 'png' = 'jpeg', quality: number = 80): Promise<FrameCapture> {
    try {
      const inputBuffer = Buffer.from(frame.data, 'base64');
      const outputBuffer = await sharp(inputBuffer)
        [format]({ quality: format === 'jpeg' ? quality : undefined })
        .toBuffer();

      return {
        ...frame,
        data: outputBuffer.toString('base64'),
        format,
        quality
      };
    } catch (error) {
      console.error('❌ Error converting frame:', error);
      throw error;
    }
  }

  /**
   * Get connection status
   */
  getStatus(): ConnectionStatus {
    return {
      isConnected: this.isConnected,
      latency: this.latency > 0 ? this.latency : undefined,
      resolution: this.remoteVideoTrack ? {
        width: 1920, // Would get from track settings
        height: 1080
      } : undefined,
      frameRate: 30, // Would calculate from actual frame rate
      lastActivity: Date.now(),
      deviceInfo: undefined // Would be set from device info
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
   * Event handler setters
   */
  onConnect(handler: (state: RTCConnectionState) => void): void {
    this.onConnectionStateChange = handler;
  }

  onMessage(handler: (message: ResponseMessage) => void): void {
    this.onDataChannelMessage = handler;
  }

  onFrame(handler: (frame: FrameCapture) => void): void {
    this.onVideoFrame = handler;
  }

  onAudio(handler: (data: ArrayBuffer) => void): void {
    this.onAudioData = handler;
  }

  onErrorHandler(handler: (error: Error) => void): void {
    this.onError = handler;
  }

  /**
   * Close the WebRTC connection
   */
  close(): void {
    if (this.dataChannel) {
      this.dataChannel.close();
    }
    
    this.peerConnection.close();
    this.isConnected = false;
    this.frameBuffer = [];
    
    console.log(`🔌 WebRTC client closed for device: ${this.deviceId}`);
  }
}