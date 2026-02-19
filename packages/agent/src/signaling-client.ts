/**
 * Signaling Client for Desktop Agent
 * 
 * Handles WebSocket connection to MCP server's signaling server:
 * - Authentication via token or pairing code
 * - WebRTC signaling exchange
 * - Connection state management
 * - Auto-reconnection
 */

import WebSocket from 'ws';
import { SignalingMessage, DeviceInfo, AgentConfig } from 'desktop-mcp-shared';
import { WebRTCPeer } from './webrtc-peer.js';

export interface SignalingClientOptions {
  signalingUrl: string;
  deviceName?: string;
  token?: string;
  autoReconnect?: boolean;
  reconnectInterval?: number;
}

export class SignalingClient {
  private websocket: WebSocket | null = null;
  private webrtcPeer: WebRTCPeer | null = null;
  private options: Required<SignalingClientOptions>;
  private isConnected = false;
  private isAuthenticated = false;
  private deviceId: string | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private connectionAttempts = 0;
  private maxReconnectAttempts = 10;

  // Event handlers
  private onConnected?: () => void;
  private onDisconnected?: () => void;
  private onAuthenticated?: (deviceInfo: DeviceInfo) => void;
  private onPairingCodeRequired?: (callback: (code: string) => void) => void;
  private onError?: (error: Error) => void;

  constructor(options: SignalingClientOptions) {
    this.options = {
      signalingUrl: options.signalingUrl,
      deviceName: options.deviceName || this.getDefaultDeviceName(),
      token: options.token || '',
      autoReconnect: options.autoReconnect !== false,
      reconnectInterval: options.reconnectInterval || 5000
    };
  }

  /**
   * Connect to signaling server
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      console.warn('⚠️ Already connected to signaling server');
      return;
    }

    try {
      console.log(`🔗 Connecting to signaling server: ${this.options.signalingUrl}`);
      
      this.websocket = new WebSocket(this.options.signalingUrl);
      this.setupWebSocketHandlers();
      
      // Wait for connection
      await new Promise<void>((resolve, reject) => {
        if (!this.websocket) {
          reject(new Error('WebSocket not created'));
          return;
        }

        this.websocket.onopen = () => {
          console.log('✅ Connected to signaling server');
          this.isConnected = true;
          this.connectionAttempts = 0;
          this.onConnected?.();
          resolve();
        };

        this.websocket.onerror = (error) => {
          console.error('❌ WebSocket connection error:', error);
          reject(new Error('Failed to connect to signaling server'));
        };

        // Timeout after 10 seconds
        setTimeout(() => {
          if (!this.isConnected) {
            reject(new Error('Connection timeout'));
          }
        }, 10000);
      });

      // Authenticate
      await this.authenticate();

    } catch (error) {
      console.error('❌ Failed to connect:', error);
      this.handleConnectionError(error instanceof Error ? error : new Error('Connection failed'));
      throw error;
    }
  }

  /**
   * Disconnect from signaling server
   */
  disconnect(): void {
    console.log('🔌 Disconnecting from signaling server...');
    
    this.isConnected = false;
    this.isAuthenticated = false;
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.webrtcPeer) {
      this.webrtcPeer.close();
      this.webrtcPeer = null;
    }

    if (this.websocket) {
      this.websocket.close(1000, 'Client disconnecting');
      this.websocket = null;
    }

    console.log('✅ Disconnected from signaling server');
  }

  /**
   * Pair with server using pairing code
   */
  async pairWithCode(pairingCode: string): Promise<string> {
    if (!this.isConnected || !this.websocket) {
      throw new Error('Not connected to signaling server');
    }

    return new Promise((resolve, reject) => {
      const message: SignalingMessage = {
        type: 'pair',
        code: pairingCode,
        data: {
          deviceName: this.options.deviceName,
          platform: process.platform,
          version: process.version
        }
      };

      // Set up response handler
      const responseHandler = (data: WebSocket.Data) => {
        try {
          const response: SignalingMessage = JSON.parse(data.toString());
          
          if (response.type === 'pair-response') {
            this.websocket?.removeListener('message', responseHandler);
            
            if (response.error) {
              reject(new Error(response.error));
              return;
            }

            if (response.data?.success && response.data?.token) {
              console.log('✅ Device paired successfully');
              this.options.token = response.data.token;
              this.deviceId = response.data.deviceInfo?.deviceId || null;
              this.isAuthenticated = true;
              
              this.onAuthenticated?.(response.data.deviceInfo);
              resolve(response.data.token);
            } else {
              reject(new Error('Pairing failed'));
            }
          }
        } catch (error) {
          reject(error);
        }
      };

      this.websocket?.on('message', responseHandler);
      this.websocket?.send(JSON.stringify(message));

      // Timeout after 30 seconds
      setTimeout(() => {
        this.websocket?.removeListener('message', responseHandler);
        reject(new Error('Pairing timeout'));
      }, 30000);
    });
  }

  private setupWebSocketHandlers(): void {
    if (!this.websocket) return;

    this.websocket.on('message', async (data: WebSocket.Data) => {
      try {
        const message: SignalingMessage = JSON.parse(data.toString());
        await this.handleSignalingMessage(message);
      } catch (error) {
        console.error('❌ Error handling signaling message:', error);
      }
    });

    this.websocket.on('close', (code, reason) => {
      console.log(`🔌 WebSocket closed: ${code} ${reason}`);
      this.handleDisconnection();
    });

    this.websocket.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
      this.onError?.(error);
    });

    // Handle ping/pong for keepalive
    this.websocket.on('ping', () => {
      this.websocket?.pong();
    });
  }

  private async authenticate(): Promise<void> {
    if (!this.websocket) {
      throw new Error('WebSocket not connected');
    }

    if (this.options.token) {
      // Authenticate with existing token
      const message: SignalingMessage = {
        type: 'auth',
        token: this.options.token
      };

      this.websocket.send(JSON.stringify(message));
      
      // Wait for auth response
      await this.waitForAuthResponse();
    } else {
      // Request pairing code
      console.log('📱 No token found, requesting pairing code...');
      
      if (this.onPairingCodeRequired) {
        this.onPairingCodeRequired(async (code: string) => {
          try {
            const token = await this.pairWithCode(code);
            console.log('✅ Authentication successful');
            await this.setupWebRTCConnection();
          } catch (error) {
            console.error('❌ Pairing failed:', error);
            this.onError?.(error instanceof Error ? error : new Error('Pairing failed'));
          }
        });
      } else {
        throw new Error('No authentication token and no pairing callback provided');
      }
    }
  }

  private async waitForAuthResponse(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.websocket) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const responseHandler = (data: WebSocket.Data) => {
        try {
          const response: SignalingMessage = JSON.parse(data.toString());
          
          if (response.type === 'auth-response') {
            this.websocket?.removeListener('message', responseHandler);
            
            if (response.error) {
              reject(new Error(response.error));
              return;
            }

            if (response.data?.success) {
              console.log('✅ Authentication successful');
              this.isAuthenticated = true;
              this.deviceId = response.data.deviceInfo?.deviceId || null;
              this.onAuthenticated?.(response.data.deviceInfo);
              resolve();
            } else {
              reject(new Error('Authentication failed'));
            }
          }
        } catch (error) {
          reject(error);
        }
      };

      this.websocket.on('message', responseHandler);

      // Timeout after 10 seconds
      setTimeout(() => {
        this.websocket?.removeListener('message', responseHandler);
        reject(new Error('Authentication timeout'));
      }, 10000);
    });
  }

  private async handleSignalingMessage(message: SignalingMessage): Promise<void> {
    if (!this.isAuthenticated && message.type !== 'auth-response' && message.type !== 'pair-response') {
      return; // Ignore messages before authentication
    }

    switch (message.type) {
      case 'offer':
        if (message.data && this.webrtcPeer) {
          console.log('📨 Received WebRTC offer');
          const answer = await this.webrtcPeer.createAnswer(message.data);
          this.sendSignalingMessage({
            type: 'answer',
            data: answer
          });
        }
        break;

      case 'ice-candidate':
        if (message.data && this.webrtcPeer) {
          console.log('🧊 Received ICE candidate');
          await this.webrtcPeer.handleIceCandidate(message.data);
        }
        break;

      case 'auth-response':
      case 'pair-response':
        // These are handled by the respective promise handlers
        break;

      default:
        console.log(`📨 Received signaling message: ${message.type}`);
    }
  }

  private async setupWebRTCConnection(): Promise<void> {
    if (!this.deviceId) {
      throw new Error('Device ID not available');
    }

    console.log('🔗 Setting up WebRTC connection...');
    
    this.webrtcPeer = new WebRTCPeer(this.deviceId);
    
    // Set up event handlers
    this.webrtcPeer.onConnect((state) => {
      console.log('✅ WebRTC connected');
    });

    this.webrtcPeer.onIce((candidate) => {
      this.sendSignalingMessage({
        type: 'ice-candidate',
        data: candidate
      });
    });

    this.webrtcPeer.onErrorHandler((error) => {
      console.error('❌ WebRTC error:', error);
      this.onError?.(error);
    });

    // Start media streams
    await this.webrtcPeer.startMediaStreams();
    
    console.log('✅ WebRTC connection ready');
  }

  private sendSignalingMessage(message: SignalingMessage): boolean {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      console.warn('⚠️ Cannot send signaling message - WebSocket not ready');
      return false;
    }

    try {
      this.websocket.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('❌ Error sending signaling message:', error);
      return false;
    }
  }

  private handleDisconnection(): void {
    this.isConnected = false;
    this.isAuthenticated = false;
    this.onDisconnected?.();

    if (this.webrtcPeer) {
      this.webrtcPeer.close();
      this.webrtcPeer = null;
    }

    // Auto-reconnect if enabled
    if (this.options.autoReconnect && this.connectionAttempts < this.maxReconnectAttempts) {
      this.connectionAttempts++;
      const delay = this.options.reconnectInterval * this.connectionAttempts; // Exponential backoff
      
      console.log(`🔄 Reconnecting in ${delay / 1000}s (attempt ${this.connectionAttempts}/${this.maxReconnectAttempts})`);
      
      this.reconnectTimer = setTimeout(() => {
        this.connect().catch((error) => {
          console.error('❌ Reconnection failed:', error);
        });
      }, delay);
    }
  }

  private handleConnectionError(error: Error): void {
    this.onError?.(error);
    
    if (this.options.autoReconnect) {
      this.handleDisconnection();
    }
  }

  private getDefaultDeviceName(): string {
    const hostname = process.env.HOSTNAME || process.env.COMPUTERNAME || 'unknown';
    const platform = process.platform;
    return `${hostname} (${platform})`;
  }

  /**
   * Update authentication token
   */
  setToken(token: string): void {
    this.options.token = token;
  }

  /**
   * Get current token
   */
  getToken(): string {
    return this.options.token;
  }

  /**
   * Check if connected and authenticated
   */
  isReady(): boolean {
    return this.isConnected && this.isAuthenticated;
  }

  /**
   * Get connection status
   */
  getConnectionStatus() {
    return {
      connected: this.isConnected,
      authenticated: this.isAuthenticated,
      deviceId: this.deviceId,
      webrtcStatus: this.webrtcPeer?.getStatus()
    };
  }

  /**
   * Event handler setters
   */
  onConnect(handler: () => void): void {
    this.onConnected = handler;
  }

  onDisconnect(handler: () => void): void {
    this.onDisconnected = handler;
  }

  onAuth(handler: (deviceInfo: DeviceInfo) => void): void {
    this.onAuthenticated = handler;
  }

  onPairingRequired(handler: (callback: (code: string) => void) => void): void {
    this.onPairingCodeRequired = handler;
  }

  onErrorHandler(handler: (error: Error) => void): void {
    this.onError = handler;
  }
}