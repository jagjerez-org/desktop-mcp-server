import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthManager } from '../src/auth.js';

describe('AuthManager', () => {
  let authManager: AuthManager;

  beforeEach(() => {
    authManager = new AuthManager();
  });

  describe('generatePairingCode', () => {
    it('should generate a 6-digit pairing code', () => {
      const pairingCode = authManager.generatePairingCode();
      
      expect(pairingCode.code).toMatch(/^\d{6}$/);
      expect(pairingCode.deviceId).toBeDefined();
      expect(pairingCode.timestamp).toBeTypeOf('number');
      expect(pairingCode.expiresAt).toBeGreaterThan(pairingCode.timestamp);
    });

    it('should generate unique codes', () => {
      const code1 = authManager.generatePairingCode();
      const code2 = authManager.generatePairingCode();
      
      expect(code1.code).not.toBe(code2.code);
      expect(code1.deviceId).not.toBe(code2.deviceId);
    });

    it('should accept custom device ID', () => {
      const customDeviceId = 'custom-device-123';
      const pairingCode = authManager.generatePairingCode(customDeviceId);
      
      expect(pairingCode.deviceId).toBe(customDeviceId);
    });
  });

  describe('pairDevice', () => {
    it('should pair device with valid code', () => {
      const pairingCode = authManager.generatePairingCode();
      const deviceName = 'Test Device';
      const platform = 'linux';
      const version = 'v18.0.0';

      const authToken = authManager.pairDevice(pairingCode.code, deviceName, platform, version);
      
      expect(authToken).toBeDefined();
      expect(authToken?.deviceId).toBe(pairingCode.deviceId);
      expect(authToken?.deviceName).toBe(deviceName);
      expect(authToken?.token).toBeDefined();
      expect(authToken?.issuedAt).toBeTypeOf('number');
      expect(authToken?.expiresAt).toBeGreaterThan(authToken!.issuedAt);

      // Check that device was registered
      const device = authManager.getDevice(pairingCode.deviceId);
      expect(device?.deviceName).toBe(deviceName);
      expect(device?.platform).toBe(platform);
      expect(device?.version).toBe(version);
      expect(device?.isActive).toBe(true);
    });

    it('should reject invalid pairing code', () => {
      const authToken = authManager.pairDevice('invalid', 'Test Device', 'linux', 'v18.0.0');
      expect(authToken).toBeNull();
    });

    it('should reject expired pairing code', () => {
      const pairingCode = authManager.generatePairingCode();
      
      // Mock expired code
      vi.spyOn(Date, 'now').mockReturnValue(pairingCode.expiresAt + 1000);
      
      const authToken = authManager.pairDevice(pairingCode.code, 'Test Device', 'linux', 'v18.0.0');
      expect(authToken).toBeNull();
      
      vi.restoreAllMocks();
    });

    it('should remove pairing code after successful pairing', () => {
      const pairingCode = authManager.generatePairingCode();
      
      expect(authManager.getActivePairingCodes()).toHaveLength(1);
      
      authManager.pairDevice(pairingCode.code, 'Test Device', 'linux', 'v18.0.0');
      
      expect(authManager.getActivePairingCodes()).toHaveLength(0);
    });
  });

  describe('verifyToken', () => {
    it('should verify valid token', () => {
      const pairingCode = authManager.generatePairingCode();
      const authToken = authManager.pairDevice(pairingCode.code, 'Test Device', 'linux', 'v18.0.0')!;
      
      const verified = authManager.verifyToken(authToken.token);
      
      expect(verified).toBeDefined();
      expect(verified?.deviceId).toBe(authToken.deviceId);
      expect(verified?.deviceName).toBe(authToken.deviceName);
    });

    it('should reject invalid token', () => {
      const verified = authManager.verifyToken('invalid-token');
      expect(verified).toBeNull();
    });

    it('should reject expired token', () => {
      const pairingCode = authManager.generatePairingCode();
      const authToken = authManager.pairDevice(pairingCode.code, 'Test Device', 'linux', 'v18.0.0')!;
      
      // Mock expired token
      vi.spyOn(Date, 'now').mockReturnValue(authToken.expiresAt + 1000);
      
      const verified = authManager.verifyToken(authToken.token);
      expect(verified).toBeNull();
      
      vi.restoreAllMocks();
    });

    it('should update device last seen on token verification', () => {
      const pairingCode = authManager.generatePairingCode();
      const authToken = authManager.pairDevice(pairingCode.code, 'Test Device', 'linux', 'v18.0.0')!;
      
      const originalLastSeen = authManager.getDevice(authToken.deviceId)?.lastSeen;
      
      // Wait a moment
      vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 1000);
      
      authManager.verifyToken(authToken.token);
      
      const updatedLastSeen = authManager.getDevice(authToken.deviceId)?.lastSeen;
      expect(updatedLastSeen).toBeGreaterThan(originalLastSeen!);
      
      vi.restoreAllMocks();
    });
  });

  describe('device management', () => {
    let deviceId: string;

    beforeEach(() => {
      const pairingCode = authManager.generatePairingCode();
      authManager.pairDevice(pairingCode.code, 'Test Device', 'linux', 'v18.0.0');
      deviceId = pairingCode.deviceId;
    });

    it('should list all registered devices', () => {
      const devices = authManager.listDevices();
      
      expect(devices).toHaveLength(1);
      expect(devices[0].deviceId).toBe(deviceId);
      expect(devices[0].deviceName).toBe('Test Device');
    });

    it('should remove device and invalidate tokens', () => {
      const result = authManager.removeDevice(deviceId);
      
      expect(result).toBe(true);
      expect(authManager.getDevice(deviceId)).toBeNull();
      expect(authManager.listDevices()).toHaveLength(0);
    });

    it('should deactivate device without removing it', () => {
      const result = authManager.deactivateDevice(deviceId);
      
      expect(result).toBe(true);
      
      const device = authManager.getDevice(deviceId);
      expect(device?.isActive).toBe(false);
      expect(authManager.listDevices()).toHaveLength(1);
    });

    it('should return false when removing non-existent device', () => {
      const result = authManager.removeDevice('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should clean up expired pairing codes', async () => {
      const pairingCode = authManager.generatePairingCode();
      expect(authManager.getActivePairingCodes()).toHaveLength(1);
      
      // Mock time to make code expired
      vi.spyOn(Date, 'now').mockReturnValue(pairingCode.expiresAt + 1000);
      
      // Trigger cleanup (simulate interval)
      (authManager as any).cleanupExpired();
      
      expect(authManager.getActivePairingCodes()).toHaveLength(0);
      
      vi.restoreAllMocks();
    });

    it('should mark inactive devices', () => {
      const pairingCode = authManager.generatePairingCode();
      authManager.pairDevice(pairingCode.code, 'Test Device', 'linux', 'v18.0.0');
      
      const device = authManager.getDevice(pairingCode.deviceId);
      expect(device?.isActive).toBe(true);
      
      // Mock time to make device inactive (10+ minutes ago)
      vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 11 * 60 * 1000);
      
      // Trigger cleanup
      (authManager as any).cleanupExpired();
      
      const updatedDevice = authManager.getDevice(pairingCode.deviceId);
      expect(updatedDevice?.isActive).toBe(false);
      
      vi.restoreAllMocks();
    });
  });
});