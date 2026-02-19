/**
 * Authentication and Device Management for Desktop MCP Server
 * 
 * Implements:
 * - 6-digit pairing codes with expiration
 * - HMAC-based JWT tokens for persistent authentication
 * - Device registration and management
 */

import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { PairingCode, AuthToken, DeviceInfo } from '@desktop-mcp/shared';

const SECRET_KEY = process.env.DESKTOP_MCP_SECRET || crypto.randomBytes(32).toString('hex');
const PAIRING_CODE_EXPIRY = 5 * 60 * 1000; // 5 minutes
const TOKEN_EXPIRY = 30 * 24 * 60 * 60 * 1000; // 30 days

export class AuthManager {
  private pairingCodes = new Map<string, PairingCode>();
  private devices = new Map<string, DeviceInfo>();
  private tokens = new Map<string, AuthToken>();

  constructor() {
    // Clean up expired codes every minute
    setInterval(() => this.cleanupExpired(), 60 * 1000);
  }

  /**
   * Generate a 6-digit pairing code for device registration
   */
  generatePairingCode(deviceId?: string): PairingCode {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const now = Date.now();
    const pairingCode: PairingCode = {
      code,
      deviceId: deviceId || uuidv4(),
      timestamp: now,
      expiresAt: now + PAIRING_CODE_EXPIRY
    };

    this.pairingCodes.set(code, pairingCode);
    return pairingCode;
  }

  /**
   * Verify pairing code and register device
   */
  pairDevice(code: string, deviceName: string, platform: string, version: string): AuthToken | null {
    const pairingCode = this.pairingCodes.get(code);
    
    if (!pairingCode || pairingCode.expiresAt < Date.now()) {
      return null;
    }

    // Register the device
    const deviceInfo: DeviceInfo = {
      deviceId: pairingCode.deviceId,
      deviceName,
      platform,
      version,
      lastSeen: Date.now(),
      isActive: true
    };

    this.devices.set(pairingCode.deviceId, deviceInfo);

    // Generate auth token
    const token = this.generateToken(pairingCode.deviceId, deviceName);
    
    // Clean up the pairing code
    this.pairingCodes.delete(code);

    return token;
  }

  /**
   * Generate a secure HMAC-based token
   */
  private generateToken(deviceId: string, deviceName: string): AuthToken {
    const now = Date.now();
    const expiresAt = now + TOKEN_EXPIRY;
    
    const payload = {
      deviceId,
      deviceName,
      issuedAt: now,
      expiresAt
    };

    const token = this.signToken(payload);
    
    const authToken: AuthToken = {
      token,
      deviceId,
      deviceName,
      issuedAt: now,
      expiresAt
    };

    this.tokens.set(token, authToken);
    return authToken;
  }

  /**
   * Verify and decode an auth token
   */
  verifyToken(token: string): AuthToken | null {
    const authToken = this.tokens.get(token);
    
    if (!authToken) {
      // Try to verify signature in case it's not in cache
      const decoded = this.verifyTokenSignature(token);
      if (!decoded) return null;
      
      // Re-cache if valid
      this.tokens.set(token, decoded);
      return decoded;
    }

    if (authToken.expiresAt < Date.now()) {
      this.tokens.delete(token);
      return null;
    }

    // Update device last seen
    const device = this.devices.get(authToken.deviceId);
    if (device) {
      device.lastSeen = Date.now();
      device.isActive = true;
    }

    return authToken;
  }

  /**
   * Get device information
   */
  getDevice(deviceId: string): DeviceInfo | null {
    return this.devices.get(deviceId) || null;
  }

  /**
   * List all registered devices
   */
  listDevices(): DeviceInfo[] {
    return Array.from(this.devices.values());
  }

  /**
   * Remove a device and invalidate its tokens
   */
  removeDevice(deviceId: string): boolean {
    const device = this.devices.get(deviceId);
    if (!device) return false;

    // Remove device
    this.devices.delete(deviceId);

    // Invalidate all tokens for this device
    for (const [token, authToken] of this.tokens.entries()) {
      if (authToken.deviceId === deviceId) {
        this.tokens.delete(token);
      }
    }

    return true;
  }

  /**
   * Mark device as inactive (but don't remove it)
   */
  deactivateDevice(deviceId: string): boolean {
    const device = this.devices.get(deviceId);
    if (!device) return false;

    device.isActive = false;
    return true;
  }

  /**
   * Get active pairing codes (for debugging)
   */
  getActivePairingCodes(): PairingCode[] {
    const now = Date.now();
    return Array.from(this.pairingCodes.values())
      .filter(code => code.expiresAt > now);
  }

  /**
   * Sign token with HMAC
   */
  private signToken(payload: any): string {
    const data = JSON.stringify(payload);
    const signature = crypto
      .createHmac('sha256', SECRET_KEY)
      .update(data)
      .digest('hex');
    
    const token = Buffer.from(data).toString('base64') + '.' + signature;
    return token;
  }

  /**
   * Verify token signature and decode payload
   */
  private verifyTokenSignature(token: string): AuthToken | null {
    try {
      const [encodedPayload, signature] = token.split('.');
      if (!encodedPayload || !signature) return null;

      const data = Buffer.from(encodedPayload, 'base64').toString('utf8');
      const expectedSignature = crypto
        .createHmac('sha256', SECRET_KEY)
        .update(data)
        .digest('hex');

      if (signature !== expectedSignature) return null;

      const payload = JSON.parse(data);
      
      // Validate payload structure
      if (!payload.deviceId || !payload.deviceName || !payload.issuedAt || !payload.expiresAt) {
        return null;
      }

      if (payload.expiresAt < Date.now()) return null;

      return {
        token,
        deviceId: payload.deviceId,
        deviceName: payload.deviceName,
        issuedAt: payload.issuedAt,
        expiresAt: payload.expiresAt
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Clean up expired pairing codes and tokens
   */
  private cleanupExpired(): void {
    const now = Date.now();

    // Clean up expired pairing codes
    for (const [code, pairingCode] of this.pairingCodes.entries()) {
      if (pairingCode.expiresAt < now) {
        this.pairingCodes.delete(code);
      }
    }

    // Clean up expired tokens
    for (const [token, authToken] of this.tokens.entries()) {
      if (authToken.expiresAt < now) {
        this.tokens.delete(token);
      }
    }

    // Mark devices as inactive if not seen in 10 minutes
    const inactiveThreshold = now - (10 * 60 * 1000);
    for (const device of this.devices.values()) {
      if (device.lastSeen < inactiveThreshold) {
        device.isActive = false;
      }
    }
  }
}