/**
 * WebRTC Signaling Server for Desktop MCP
 * 
 * Handles:
 * - WebSocket connections from desktop agents
 * - WebRTC offer/answer/ICE candidate exchange
 * - Authentication via pairing codes and tokens
 * - Connection state management
 */

import WebSocket, { WebSocketServer } from 'ws';
import { AuthManager } from './auth.js';
import { SignalingMessage, DeviceInfo } from 'desktop-mcp-shared';

export interface ConnectedAgent {
  deviceId: string;
  deviceInfo: DeviceInfo;
  websocket: WebSocket;
  authenticated: boolean;
  connectedAt: number;
}

export class SignalingServer {
  private server: WebSocket.Server;
  private authManager: AuthManager;
  private connectedAgents = new Map<string, ConnectedAgent>();
  private onAgentConnected?: (agent: ConnectedAgent) => void;
  private onAgentDisconnected?: (deviceId: string) => void;
  private onSignalingMessage?: (deviceId: string, message: SignalingMessage) => void;

  constructor(port: number, authManager: AuthManager) {
    this.authManager = authManager;
    this.server = new WebSocketServer({ port });
    this.setupWebSocketServer();
    
    console.log(`🔗 Signaling server listening on port ${port}`);
  }

  private setupWebSocketServer(): void {
    this.server.on('connection', (ws: WebSocket, req) => {
      const clientIp = req.socket.remoteAddress;
      console.log(`🔌 New WebSocket connection from ${clientIp}`);

      let agent: ConnectedAgent | null = null;

      // Handle authentication timeout
      const authTimeout = setTimeout(() => {
        if (!agent?.authenticated) {
          console.log(`⏰ Authentication timeout for ${clientIp}`);
          ws.close(1008, 'Authentication timeout');
        }
      }, 30000); // 30 seconds

      ws.on('message', async (data: WebSocket.Data) => {
        try {
          const message: SignalingMessage = JSON.parse(data.toString());
          
          if (!agent) {
            // Handle initial authentication
            if (message.type === 'auth' && message.token) {
              const authToken = this.authManager.verifyToken(message.token);
              if (authToken) {
                const deviceInfo = this.authManager.getDevice(authToken.deviceId);
                if (deviceInfo) {
                  agent = {
                    deviceId: authToken.deviceId,
                    deviceInfo,
                    websocket: ws,
                    authenticated: true,
                    connectedAt: Date.now()
                  };

                  this.connectedAgents.set(authToken.deviceId, agent);
                  clearTimeout(authTimeout);
                  
                  console.log(`✅ Agent authenticated: ${deviceInfo.deviceName} (${authToken.deviceId})`);
                  
                  ws.send(JSON.stringify({
                    type: 'auth-response',
                    data: { success: true, deviceInfo }
                  }));

                  this.onAgentConnected?.(agent);
                  return;
                }
              }
              
              ws.send(JSON.stringify({
                type: 'auth-response',
                error: 'Invalid token'
              }));
              ws.close(1008, 'Invalid token');
              return;
            }

            // Handle pairing request
            if (message.type === 'pair' && message.code && message.data) {
              const { deviceName, platform, version } = message.data;
              const authToken = this.authManager.pairDevice(message.code, deviceName, platform, version);
              
              if (authToken) {
                const deviceInfo = this.authManager.getDevice(authToken.deviceId)!;
                
                agent = {
                  deviceId: authToken.deviceId,
                  deviceInfo,
                  websocket: ws,
                  authenticated: true,
                  connectedAt: Date.now()
                };

                this.connectedAgents.set(authToken.deviceId, agent);
                clearTimeout(authTimeout);
                
                console.log(`🔗 Device paired: ${deviceName} (${authToken.deviceId})`);
                
                ws.send(JSON.stringify({
                  type: 'pair-response',
                  data: { 
                    success: true, 
                    token: authToken.token,
                    deviceInfo 
                  }
                }));

                this.onAgentConnected?.(agent);
                return;
              }
              
              ws.send(JSON.stringify({
                type: 'pair-response',
                error: 'Invalid pairing code'
              }));
              return;
            }

            ws.send(JSON.stringify({
              type: 'auth-response',
              error: 'Authentication required'
            }));
            return;
          }

          // Handle authenticated messages
          if (!agent.authenticated) return;

          // Forward signaling messages to the MCP server
          if (['offer', 'answer', 'ice-candidate'].includes(message.type)) {
            this.onSignalingMessage?.(agent.deviceId, message);
          }

        } catch (error) {
          console.error('❌ Error handling signaling message:', error);
          ws.send(JSON.stringify({
            type: 'error',
            error: 'Invalid message format'
          }));
        }
      });

      ws.on('close', (code, reason) => {
        console.log(`🔌 WebSocket closed: ${code} ${reason}`);
        clearTimeout(authTimeout);
        
        if (agent) {
          this.connectedAgents.delete(agent.deviceId);
          this.authManager.deactivateDevice(agent.deviceId);
          this.onAgentDisconnected?.(agent.deviceId);
          console.log(`📴 Agent disconnected: ${agent.deviceInfo.deviceName}`);
        }
      });

      ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
      });

      // Send ping every 30 seconds to keep connection alive
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        } else {
          clearInterval(pingInterval);
        }
      }, 30000);

      ws.on('close', () => clearInterval(pingInterval));
    });

    this.server.on('error', (error) => {
      console.error('❌ Signaling server error:', error);
    });
  }

  /**
   * Send a signaling message to a specific device
   */
  sendToAgent(deviceId: string, message: SignalingMessage): boolean {
    const agent = this.connectedAgents.get(deviceId);
    if (!agent || agent.websocket.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      agent.websocket.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error(`❌ Error sending message to ${deviceId}:`, error);
      return false;
    }
  }

  /**
   * Get connected agent by device ID
   */
  getConnectedAgent(deviceId: string): ConnectedAgent | null {
    return this.connectedAgents.get(deviceId) || null;
  }

  /**
   * Get all connected agents
   */
  getConnectedAgents(): ConnectedAgent[] {
    return Array.from(this.connectedAgents.values());
  }

  /**
   * Disconnect an agent
   */
  disconnectAgent(deviceId: string, reason?: string): boolean {
    const agent = this.connectedAgents.get(deviceId);
    if (!agent) return false;

    agent.websocket.close(1000, reason || 'Disconnected by server');
    return true;
  }

  /**
   * Set event handlers
   */
  onConnect(handler: (agent: ConnectedAgent) => void): void {
    this.onAgentConnected = handler;
  }

  onDisconnect(handler: (deviceId: string) => void): void {
    this.onAgentDisconnected = handler;
  }

  onMessage(handler: (deviceId: string, message: SignalingMessage) => void): void {
    this.onSignalingMessage = handler;
  }

  /**
   * Close the signaling server
   */
  close(): Promise<void> {
    return new Promise((resolve) => {
      // Close all connections
      for (const agent of this.connectedAgents.values()) {
        agent.websocket.close(1001, 'Server shutting down');
      }
      
      this.server.close(() => {
        console.log('🛑 Signaling server closed');
        resolve();
      });
    });
  }

  /**
   * Get server statistics
   */
  getStats() {
    return {
      connectedAgents: this.connectedAgents.size,
      totalDevices: this.authManager.listDevices().length,
      activePairingCodes: this.authManager.getActivePairingCodes().length,
      uptime: process.uptime()
    };
  }
}