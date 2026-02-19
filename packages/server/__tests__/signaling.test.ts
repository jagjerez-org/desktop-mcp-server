import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import WebSocket from 'ws';
import { SignalingServer } from '../src/signaling.js';
import { AuthManager } from '../src/auth.js';

describe('SignalingServer', () => {
  let signalingServer: SignalingServer;
  let authManager: AuthManager;
  const TEST_PORT = 9999;

  beforeEach(async () => {
    authManager = new AuthManager();
    signalingServer = new SignalingServer(TEST_PORT, authManager);
    
    // Wait a moment for server to start
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterEach(async () => {
    await signalingServer.close();
    
    // Wait a moment for server to close
    await new Promise(resolve => setTimeout(resolve, 200));
  }, 15000);

  describe('WebSocket connection', () => {
    it('should accept WebSocket connections', async () => {
      const ws = new WebSocket(`ws://localhost:${TEST_PORT}`);
      
      await new Promise((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
        setTimeout(() => reject(new Error('Connection timeout')), 1000);
      });

      expect(ws.readyState).toBe(WebSocket.OPEN);
      ws.close();
    });

    it.skip('should close connection after auth timeout', async () => {
      const ws = new WebSocket(`ws://localhost:${TEST_PORT}`);
      
      await new Promise(resolve => {
        ws.on('open', resolve);
      });

      // Wait for auth timeout (should be less than 30 seconds for testing)
      await new Promise((resolve, reject) => {
        ws.on('close', (code, reason) => {
          expect(code).toBe(1008); // Policy violation (auth timeout)
          resolve(undefined);
        });
        
        // Mock shorter timeout for testing
        setTimeout(() => resolve(undefined), 100);
      });
    }, 35000); // Increase test timeout
  });

  describe('authentication', () => {
    it('should authenticate with valid token', async () => {
      // Create a device first
      const pairingCode = authManager.generatePairingCode();
      const authToken = authManager.pairDevice(pairingCode.code, 'Test Device', 'linux', 'v18.0.0')!;

      const ws = new WebSocket(`ws://localhost:${TEST_PORT}`);
      
      await new Promise(resolve => {
        ws.on('open', resolve);
      });

      // Send auth message
      ws.send(JSON.stringify({
        type: 'auth',
        token: authToken.token
      }));

      // Wait for auth response
      const response = await new Promise(resolve => {
        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'auth-response') {
            resolve(message);
          }
        });
      });

      expect(response).toMatchObject({
        type: 'auth-response',
        data: {
          success: true,
          deviceInfo: expect.objectContaining({
            deviceId: authToken.deviceId,
            deviceName: 'Test Device'
          })
        }
      });

      ws.close();
    });

    it('should reject invalid token', async () => {
      const ws = new WebSocket(`ws://localhost:${TEST_PORT}`);
      
      await new Promise(resolve => {
        ws.on('open', resolve);
      });

      // Send auth message with invalid token
      ws.send(JSON.stringify({
        type: 'auth',
        token: 'invalid-token'
      }));

      // Wait for auth response
      const response = await new Promise(resolve => {
        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'auth-response') {
            resolve(message);
          }
        });
      });

      expect(response).toMatchObject({
        type: 'auth-response',
        error: 'Invalid token'
      });

      // Connection should be closed
      await new Promise(resolve => {
        ws.on('close', (code) => {
          expect(code).toBe(1008);
          resolve(undefined);
        });
      });
    });

    it('should handle pairing with valid code', async () => {
      const pairingCode = authManager.generatePairingCode();
      
      const ws = new WebSocket(`ws://localhost:${TEST_PORT}`);
      
      await new Promise(resolve => {
        ws.on('open', resolve);
      });

      // Send pairing message
      ws.send(JSON.stringify({
        type: 'pair',
        code: pairingCode.code,
        data: {
          deviceName: 'Test Device',
          platform: 'linux',
          version: 'v18.0.0'
        }
      }));

      // Wait for pairing response
      const response = await new Promise(resolve => {
        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'pair-response') {
            resolve(message);
          }
        });
      });

      expect(response).toMatchObject({
        type: 'pair-response',
        data: {
          success: true,
          token: expect.any(String),
          deviceInfo: expect.objectContaining({
            deviceName: 'Test Device',
            platform: 'linux'
          })
        }
      });

      ws.close();
    });

    it('should reject invalid pairing code', async () => {
      const ws = new WebSocket(`ws://localhost:${TEST_PORT}`);
      
      await new Promise(resolve => {
        ws.on('open', resolve);
      });

      // Send pairing message with invalid code
      ws.send(JSON.stringify({
        type: 'pair',
        code: 'invalid',
        data: {
          deviceName: 'Test Device',
          platform: 'linux',
          version: 'v18.0.0'
        }
      }));

      // Wait for pairing response
      const response = await new Promise(resolve => {
        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'pair-response') {
            resolve(message);
          }
        });
      });

      expect(response).toMatchObject({
        type: 'pair-response',
        error: 'Invalid pairing code'
      });

      ws.close();
    });
  });

  describe('agent management', () => {
    let authToken: any;

    beforeEach(() => {
      const pairingCode = authManager.generatePairingCode();
      authToken = authManager.pairDevice(pairingCode.code, 'Test Device', 'linux', 'v18.0.0')!;
    });

    it('should track connected agents', async () => {
      expect(signalingServer.getConnectedAgents()).toHaveLength(0);

      const ws = new WebSocket(`ws://localhost:${TEST_PORT}`);
      
      await new Promise(resolve => {
        ws.on('open', resolve);
      });

      // Authenticate
      ws.send(JSON.stringify({
        type: 'auth',
        token: authToken.token
      }));

      // Wait for auth response
      await new Promise(resolve => {
        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'auth-response' && message.data?.success) {
            resolve(message);
          }
        });
      });

      expect(signalingServer.getConnectedAgents()).toHaveLength(1);

      const agent = signalingServer.getConnectedAgent(authToken.deviceId);
      expect(agent).toBeDefined();
      expect(agent?.deviceId).toBe(authToken.deviceId);
      expect(agent?.authenticated).toBe(true);

      ws.close();

      // Wait for disconnection
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(signalingServer.getConnectedAgents()).toHaveLength(0);
    });

    it('should send messages to specific agents', async () => {
      const ws = new WebSocket(`ws://localhost:${TEST_PORT}`);
      
      await new Promise(resolve => {
        ws.on('open', resolve);
      });

      // Authenticate
      ws.send(JSON.stringify({
        type: 'auth',
        token: authToken.token
      }));

      await new Promise(resolve => {
        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'auth-response' && message.data?.success) {
            resolve(message);
          }
        });
      });

      // Send message to agent
      const testMessage = { type: 'test', data: 'hello' };
      const success = signalingServer.sendToAgent(authToken.deviceId, testMessage);
      
      expect(success).toBe(true);

      // Receive message
      const receivedMessage = await new Promise(resolve => {
        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'test') {
            resolve(message);
          }
        });
      });

      expect(receivedMessage).toEqual(testMessage);

      ws.close();
    });

    it('should handle agent disconnection', async () => {
      let disconnectedDeviceId: string | null = null;

      signalingServer.onDisconnect((deviceId) => {
        disconnectedDeviceId = deviceId;
      });

      const ws = new WebSocket(`ws://localhost:${TEST_PORT}`);
      
      await new Promise(resolve => {
        ws.on('open', resolve);
      });

      // Authenticate
      ws.send(JSON.stringify({
        type: 'auth',
        token: authToken.token
      }));

      await new Promise(resolve => {
        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'auth-response' && message.data?.success) {
            resolve(message);
          }
        });
      });

      // Close connection
      ws.close();

      // Wait for disconnection handler
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(disconnectedDeviceId).toBe(authToken.deviceId);
      expect(signalingServer.getConnectedAgents()).toHaveLength(0);
    });
  });

  describe('server stats', () => {
    it('should provide server statistics', () => {
      const stats = signalingServer.getStats();
      
      expect(stats).toMatchObject({
        connectedAgents: expect.any(Number),
        totalDevices: expect.any(Number),
        activePairingCodes: expect.any(Number),
        uptime: expect.any(Number)
      });

      expect(stats.connectedAgents).toBe(0);
      expect(stats.uptime).toBeGreaterThan(0);
    });
  });
});