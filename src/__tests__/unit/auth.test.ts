import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Mock fs operations for isolated testing
let mockConfigDir: string;
let mockTokensFile: string;
let mockSecretFile: string;

// Store original functions
const originalReadFileSync = readFileSync;
const originalWriteFileSync = writeFileSync;
const originalExistsSync = existsSync;
const originalMkdirSync = mkdirSync;

vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
  };
});

vi.mock('os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('os')>();
  return {
    ...actual,
    homedir: () => mockConfigDir || '/tmp/test-home',
  };
});

describe('Auth Module', () => {
  let mockFs: any;

  beforeEach(async () => {
    // Create a temporary directory for testing
    mockConfigDir = join(tmpdir(), 'desktop-mcp-test', Date.now().toString());
    mockTokensFile = join(mockConfigDir, '.desktop-mcp', 'tokens.json');
    mockSecretFile = join(mockConfigDir, '.desktop-mcp', 'server.secret');
    
    // Reset mocks
    mockFs = await import('fs');
    vi.clearAllMocks();
    
    // Mock filesystem state
    const mockFiles = new Map<string, string>();
    const mockDirs = new Set<string>();
    
    vi.mocked(mockFs.existsSync).mockImplementation((path: string) => {
      return mockDirs.has(path) || mockFiles.has(path);
    });
    
    vi.mocked(mockFs.readFileSync).mockImplementation((path: string) => {
      const content = mockFiles.get(path);
      if (content === undefined) throw new Error('File not found');
      return content;
    });
    
    vi.mocked(mockFs.writeFileSync).mockImplementation((path: string, data: string) => {
      mockFiles.set(path, data);
    });
    
    vi.mocked(mockFs.mkdirSync).mockImplementation((path: string) => {
      mockDirs.add(path);
    });
    
    // Reset module state by re-importing
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initAuth', () => {
    it('should create config directory if it does not exist', async () => {
      const { initAuth } = await import('../../auth.js');
      
      initAuth();
      
      expect(mockFs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('.desktop-mcp'), 
        { recursive: true }
      );
    });

    it('should create server secret if it does not exist', async () => {
      const { initAuth } = await import('../../auth.js');
      
      initAuth();
      
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('server.secret'),
        expect.any(String),
        { mode: 0o600 }
      );
    });

    it('should load existing server secret', async () => {
      const existingSecret = 'existing-secret-key';
      vi.mocked(mockFs.existsSync).mockImplementation((path: string) => {
        return path.includes('server.secret');
      });
      vi.mocked(mockFs.readFileSync).mockImplementation((path: string) => {
        if (path.includes('server.secret')) return existingSecret;
        if (path.includes('tokens.json')) return '[]';
        throw new Error('File not found');
      });
      
      const { initAuth } = await import('../../auth.js');
      
      expect(() => initAuth()).not.toThrow();
    });

    it('should load existing paired devices', async () => {
      const existingDevices = [
        {
          id: 'test-device',
          name: 'Test Device',
          tokenHash: 'hash123',
          pairedAt: '2024-01-01T00:00:00Z',
          lastSeen: '2024-01-01T00:00:00Z',
          ip: '192.168.1.100'
        }
      ];
      
      vi.mocked(mockFs.existsSync).mockReturnValue(true);
      vi.mocked(mockFs.readFileSync).mockImplementation((path: string) => {
        if (path.includes('server.secret')) return 'secret-key';
        if (path.includes('tokens.json')) return JSON.stringify(existingDevices);
        throw new Error('File not found');
      });
      
      const { initAuth, listDevices } = await import('../../auth.js');
      
      initAuth();
      const devices = listDevices();
      
      expect(devices).toHaveLength(1);
      expect(devices[0]).toEqual(expect.objectContaining({
        id: 'test-device',
        name: 'Test Device'
      }));
    });
  });

  describe('startPairing', () => {
    it('should generate a 6-digit pairing code', async () => {
      const { initAuth, startPairing } = await import('../../auth.js');
      
      initAuth();
      const code = startPairing(120);
      
      expect(code).toMatch(/^\d{6}$/);
    });

    it('should set correct expiration time', async () => {
      const { initAuth, startPairing, isPairingActive } = await import('../../auth.js');
      
      initAuth();
      const ttl = 60; // 1 minute
      startPairing(ttl);
      
      expect(isPairingActive()).toBe(true);
    });
  });

  describe('completePairing', () => {
    it('should return null if no active pairing session', async () => {
      const { initAuth, completePairing } = await import('../../auth.js');
      
      initAuth();
      const result = completePairing('123456', 'Test Device', '192.168.1.100');
      
      expect(result).toBeNull();
    });

    it('should return null if pairing code expired', async () => {
      const { initAuth, startPairing, completePairing } = await import('../../auth.js');
      
      initAuth();
      startPairing(-1); // Already expired
      
      // Wait a bit to ensure expiration
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const result = completePairing('123456', 'Test Device', '192.168.1.100');
      
      expect(result).toBeNull();
    });

    it('should return null for invalid pairing code', async () => {
      const { initAuth, startPairing, completePairing } = await import('../../auth.js');
      
      initAuth();
      const code = startPairing(120);
      const result = completePairing('000000', 'Test Device', '192.168.1.100');
      
      expect(result).toBeNull();
    });

    it('should successfully pair with valid code', async () => {
      const { initAuth, startPairing, completePairing } = await import('../../auth.js');
      
      initAuth();
      const code = startPairing(120);
      const result = completePairing(code, 'Test Device', '192.168.1.100');
      
      expect(result).not.toBeNull();
      expect(result?.token).toMatch(/^dmcp_[a-f0-9]{16}_[a-zA-Z0-9_-]+$/);
      expect(result?.deviceId).toMatch(/^[a-f0-9]{16}$/);
    });

    it('should save paired device to storage', async () => {
      const { initAuth, startPairing, completePairing, listDevices } = await import('../../auth.js');
      
      initAuth();
      const code = startPairing(120);
      const result = completePairing(code, 'Test Device', '192.168.1.100');
      
      expect(result).not.toBeNull();
      
      const devices = listDevices();
      expect(devices).toHaveLength(1);
      expect(devices[0]).toEqual(expect.objectContaining({
        name: 'Test Device',
        ip: '192.168.1.100'
      }));
    });
  });

  describe('validateToken', () => {
    it('should return null for invalid token', async () => {
      const { initAuth, validateToken } = await import('../../auth.js');
      
      initAuth();
      const result = validateToken('invalid-token', '192.168.1.100');
      
      expect(result).toBeNull();
    });

    it('should validate correct token and update last seen', async () => {
      const { initAuth, startPairing, completePairing, validateToken } = await import('../../auth.js');
      
      initAuth();
      const code = startPairing(120);
      const pairResult = completePairing(code, 'Test Device', '192.168.1.100');
      
      expect(pairResult).not.toBeNull();
      
      const validateResult = validateToken(pairResult!.token, '192.168.1.200');
      
      expect(validateResult).not.toBeNull();
      expect(validateResult?.name).toBe('Test Device');
      expect(validateResult?.ip).toBe('192.168.1.200'); // Updated IP
    });
  });

  describe('revokeDevice', () => {
    it('should return false for non-existent device', async () => {
      const { initAuth, revokeDevice } = await import('../../auth.js');
      
      initAuth();
      const result = revokeDevice('non-existent');
      
      expect(result).toBe(false);
    });

    it('should successfully revoke existing device', async () => {
      const { initAuth, startPairing, completePairing, revokeDevice, listDevices } = await import('../../auth.js');
      
      initAuth();
      const code = startPairing(120);
      const pairResult = completePairing(code, 'Test Device', '192.168.1.100');
      
      expect(pairResult).not.toBeNull();
      expect(listDevices()).toHaveLength(1);
      
      const revokeResult = revokeDevice(pairResult!.deviceId);
      
      expect(revokeResult).toBe(true);
      expect(listDevices()).toHaveLength(0);
    });
  });

  describe('revokeAll', () => {
    it('should revoke all devices and return count', async () => {
      const { initAuth, startPairing, completePairing, revokeAll, listDevices } = await import('../../auth.js');
      
      initAuth();
      
      // Pair two devices
      let code = startPairing(120);
      completePairing(code, 'Device 1', '192.168.1.100');
      
      code = startPairing(120);
      completePairing(code, 'Device 2', '192.168.1.101');
      
      expect(listDevices()).toHaveLength(2);
      
      const revokeCount = revokeAll();
      
      expect(revokeCount).toBe(2);
      expect(listDevices()).toHaveLength(0);
    });
  });

  describe('listDevices', () => {
    it('should not expose token hashes', async () => {
      const { initAuth, startPairing, completePairing, listDevices } = await import('../../auth.js');
      
      initAuth();
      const code = startPairing(120);
      completePairing(code, 'Test Device', '192.168.1.100');
      
      const devices = listDevices();
      
      expect(devices[0]).not.toHaveProperty('tokenHash');
    });
  });
});