import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createServer } from 'http';
import { tmpdir } from 'os';
import { join } from 'path';
import { rmSync, mkdirSync } from 'fs';

// Mock nut-js since there's no display in CI
vi.mock('@nut-tree-fork/nut-js', () => ({
  mouse: {
    config: { autoDelayMs: 0, mouseSpeed: 0 },
    setPosition: vi.fn().mockResolvedValue(undefined),
    getPosition: vi.fn().mockResolvedValue({ x: 100, y: 100 }),
    click: vi.fn().mockResolvedValue(undefined),
    doubleClick: vi.fn().mockResolvedValue(undefined),
    pressButton: vi.fn().mockResolvedValue(undefined),
    releaseButton: vi.fn().mockResolvedValue(undefined),
    scrollUp: vi.fn().mockResolvedValue(undefined),
    scrollDown: vi.fn().mockResolvedValue(undefined),
  },
  keyboard: {
    config: { autoDelayMs: 0 },
    type: vi.fn().mockResolvedValue(undefined),
    pressKey: vi.fn().mockResolvedValue(undefined),
    releaseKey: vi.fn().mockResolvedValue(undefined),
  },
  screen: {
    width: vi.fn().mockResolvedValue(1920),
    height: vi.fn().mockResolvedValue(1080),
  },
  Button: {
    LEFT: 'left',
    RIGHT: 'right',
    MIDDLE: 'middle',
  },
  Key: {
    Enter: 'Enter',
    Tab: 'Tab',
    A: 'A',
    LeftControl: 'LeftControl',
    // Add other keys as needed
  },
  Point: class Point {
    constructor(public x: number, public y: number) {}
  },
}));

// Mock screenshot-desktop since there's no display in CI
vi.mock('screenshot-desktop', () => ({
  default: vi.fn().mockResolvedValue(Buffer.from('fake-png-data')),
}));

// Mock child_process for commands that won't work in CI
vi.mock('child_process', () => ({
  execSync: vi.fn().mockReturnValue('mocked output'),
}));

describe('Server Integration Tests', () => {
  let server: any;
  let testConfigDir: string;
  let app: any;
  let originalHomedir: () => string;

  beforeAll(async () => {
    // Create temporary config directory
    testConfigDir = join(tmpdir(), 'desktop-mcp-test', Date.now().toString());
    mkdirSync(testConfigDir, { recursive: true });

    // Mock homedir to return our test directory
    originalHomedir = (await import('os')).homedir;
    vi.doMock('os', () => ({
      homedir: () => testConfigDir,
      tmpdir,
      platform: () => 'linux',
    }));

    // Reset modules to use mocked os
    vi.resetModules();
  });

  afterAll(() => {
    // Cleanup test directory
    try {
      rmSync(testConfigDir, { recursive: true, force: true });
    } catch (err) {
      console.warn('Failed to cleanup test directory:', err);
    }
  });

  beforeEach(async () => {
    // Create unique test directory for each test
    testConfigDir = join(tmpdir(), 'desktop-mcp-test', Date.now().toString(), Math.random().toString(36).substr(2, 9));
    mkdirSync(testConfigDir, { recursive: true });
    
    // Mock homedir to return our unique test directory
    vi.doMock('os', () => ({
      homedir: () => testConfigDir,
      tmpdir,
      platform: () => 'linux',
    }));
    
    // Reset modules to ensure clean state
    vi.resetModules();
    
    // Import the main module after mocks are set up
    const mainModule = await import('../../index.js');
    
    // Create HTTP server manually for testing
    const { createServer } = await import('http');
    const { StreamableHTTPServerTransport } = await import('@modelcontextprotocol/sdk/server/streamableHttp.js');
    const authModule = await import('../../auth.js');

    authModule.initAuth();

    const getClientIp = (req: any) =>
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ?? 
      req.socket?.remoteAddress ?? 
      'unknown';

    const readBody = (req: any): Promise<string> =>
      new Promise((resolve) => {
        let body = '';
        req.on('data', (c: Buffer) => (body += c.toString()));
        req.on('end', () => resolve(body));
      });

    const json = (res: any, status: number, data: any) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };

    // Simplified handler for testing
    const handler = async (req: any, res: any) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Mcp-Session-Id');
      
      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      const url = req.url?.split('?')[0];

      // Health endpoint
      if (url === '/health') {
        json(res, 200, {
          status: 'ok',
          transport: 'http',
          tools: 16,
          pairedDevices: authModule.listDevices().length,
          pairingActive: authModule.isPairingActive(),
        });
        return;
      }

      // Pairing endpoint
      if (url === '/pair' && req.method === 'POST') {
        const body = JSON.parse(await readBody(req));
        const { code, name } = body;
        
        if (!code || !name) {
          json(res, 400, { error: "Provide 'code' and 'name'" });
          return;
        }
        
        const result = authModule.completePairing(code, name, getClientIp(req));
        if (!result) {
          json(res, 403, { error: 'Invalid or expired pairing code' });
          return;
        }
        
        json(res, 200, {
          token: result.token,
          deviceId: result.deviceId,
          message: 'Paired successfully. Store this token securely — it won\'t be shown again.',
        });
        return;
      }

      // Auth required endpoints
      const device = authModule.authenticate(req);
      if (!device) {
        json(res, 401, { error: 'Unauthorized. Pair first via POST /pair with a pairing code.' });
        return;
      }

      // Devices endpoint
      if (url === '/devices' && req.method === 'GET') {
        json(res, 200, { devices: authModule.listDevices() });
        return;
      }

      // Start pairing endpoint
      if (url === '/devices/pair' && req.method === 'POST') {
        const body = JSON.parse(await readBody(req));
        const ttl = body.ttlSeconds ?? 120;
        const code = authModule.startPairing(ttl);
        json(res, 200, { code, expiresIn: ttl, message: 'Share this code with the device to pair.' });
        return;
      }

      // Device revocation
      if (url?.startsWith('/devices/') && req.method === 'DELETE') {
        const id = url.split('/')[2];
        if (id === 'all') {
          const count = authModule.revokeAll();
          json(res, 200, { revoked: count });
        } else {
          const ok = authModule.revokeDevice(id!);
          json(res, ok ? 200 : 404, ok ? { revoked: id } : { error: 'Device not found' });
        }
        return;
      }

      res.writeHead(404);
      res.end('Not found');
    };

    app = createServer(handler);
  });

  afterEach(() => {
    if (server) {
      server.close();
      server = null;
    }
    
    // Cleanup individual test directory
    try {
      rmSync(testConfigDir, { recursive: true, force: true });
    } catch (err) {
      // Ignore cleanup errors
    }
  });

  describe('Health endpoint', () => {
    it('should return server status', async () => {
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: 'ok',
        transport: 'http',
        tools: 16,
        pairedDevices: 0,
        pairingActive: false,
      });
    });
  });

  describe('CORS headers', () => {
    it('should include proper CORS headers', async () => {
      const response = await request(app).get('/health');
      
      expect(response.headers['access-control-allow-origin']).toBe('*');
      expect(response.headers['access-control-allow-methods']).toContain('GET');
      expect(response.headers['access-control-allow-methods']).toContain('POST');
    });

    it('should handle OPTIONS requests', async () => {
      const response = await request(app).options('/health');
      
      expect(response.status).toBe(204);
    });
  });

  describe('Pairing flow', () => {
    it('should reject pairing without active session', async () => {
      const response = await request(app)
        .post('/pair')
        .send({ code: '123456', name: 'Test Device' });
      
      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Invalid or expired');
    });

    it('should reject pairing with missing parameters', async () => {
      const response = await request(app)
        .post('/pair')
        .send({ code: '123456' }); // Missing name
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Provide 'code' and 'name'");
    });

    it('should complete pairing flow successfully', async () => {
      const authModule = await import('../../auth.js');
      
      // Start pairing
      const code = authModule.startPairing(120);
      
      // Complete pairing
      const response = await request(app)
        .post('/pair')
        .send({ code, name: 'Test Device' });
      
      expect(response.status).toBe(200);
      expect(response.body.token).toMatch(/^dmcp_[a-f0-9]{16}_[a-zA-Z0-9_-]+$/);
      expect(response.body.deviceId).toMatch(/^[a-f0-9]{16}$/);
      expect(response.body.message).toContain('Paired successfully');
    });

    it('should reject pairing with wrong code', async () => {
      const authModule = await import('../../auth.js');
      
      // Start pairing
      authModule.startPairing(120);
      
      // Try with wrong code
      const response = await request(app)
        .post('/pair')
        .send({ code: '000000', name: 'Test Device' });
      
      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Invalid or expired');
    });
  });

  describe('Authentication', () => {
    let token: string;

    beforeEach(async () => {
      const authModule = await import('../../auth.js');
      const code = authModule.startPairing(120);
      const result = authModule.completePairing(code, 'Test Device', '127.0.0.1');
      token = result!.token;
    });

    it('should reject requests without token', async () => {
      const response = await request(app).get('/devices');
      
      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Unauthorized');
    });

    it('should accept requests with valid token', async () => {
      const response = await request(app)
        .get('/devices')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.devices).toHaveLength(1);
    });

    it('should reject requests with invalid token', async () => {
      const response = await request(app)
        .get('/devices')
        .set('Authorization', 'Bearer invalid-token');
      
      expect(response.status).toBe(401);
    });
  });

  describe('Device management', () => {
    let token: string;
    let deviceId: string;

    beforeEach(async () => {
      const authModule = await import('../../auth.js');
      const code = authModule.startPairing(120);
      const result = authModule.completePairing(code, 'Test Device', '127.0.0.1');
      token = result!.token;
      deviceId = result!.deviceId;
    });

    it('should list paired devices', async () => {
      const response = await request(app)
        .get('/devices')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.devices).toHaveLength(1);
      expect(response.body.devices[0]).toEqual(expect.objectContaining({
        id: deviceId,
        name: 'Test Device',
      }));
    });

    it('should start new pairing session', async () => {
      const response = await request(app)
        .post('/devices/pair')
        .set('Authorization', `Bearer ${token}`)
        .send({ ttlSeconds: 60 });
      
      expect(response.status).toBe(200);
      expect(response.body.code).toMatch(/^\d{6}$/);
      expect(response.body.expiresIn).toBe(60);
    });

    it('should revoke specific device', async () => {
      const response = await request(app)
        .delete(`/devices/${deviceId}`)
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.revoked).toBe(deviceId);
    });

    it('should return 404 for non-existent device revocation', async () => {
      const response = await request(app)
        .delete('/devices/non-existent')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Device not found');
    });

    it('should revoke all devices', async () => {
      const response = await request(app)
        .delete('/devices/all')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.revoked).toBe(1);
    });
  });

  describe('404 handling', () => {
    let token: string;

    beforeEach(async () => {
      const authModule = await import('../../auth.js');
      const code = authModule.startPairing(120);
      const result = authModule.completePairing(code, 'Test Device', '127.0.0.1');
      token = result!.token;
    });

    it('should return 404 for unknown endpoints', async () => {
      const response = await request(app)
        .get('/unknown')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(404);
    });
  });
});