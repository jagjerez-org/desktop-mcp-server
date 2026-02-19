/**
 * Simplified types for Desktop MCP Server (without WebRTC browser dependencies)
 */

// ===== Authentication Types =====
export interface PairingCode {
  code: string;
  deviceId: string;
  timestamp: number;
  expiresAt: number;
}

export interface AuthToken {
  token: string;
  deviceId: string;
  deviceName: string;
  issuedAt: number;
  expiresAt: number;
}

export interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  platform: string;
  version: string;
  lastSeen: number;
  isActive: boolean;
}

// ===== Basic Types =====
export interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'auth' | 'auth-response' | 'pair' | 'pair-response';
  data?: any;
  deviceId?: string;
  token?: string;
  code?: string;
  error?: string;
}

export interface ScreenInfo {
  width: number;
  height: number;
  cursorX: number;
  cursorY: number;
  scaleFactor: number;
}

export interface ConnectionStatus {
  isConnected: boolean;
  latency?: number;
  lastActivity: number;
}

// ===== Mouse/Input Types =====
export type MouseButton = 'left' | 'right' | 'middle';

export interface MousePosition {
  x: number;
  y: number;
}

// ===== Tool Result Types =====
export interface ToolResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

// ===== Configuration Types =====
export interface ServerConfig {
  port?: number;
  host?: string;
  signalingPort?: number;
  maxConnections?: number;
  tokenExpiry?: number;
  pairingCodeExpiry?: number;
}

export interface AgentConfig {
  signalingUrl: string;
  deviceName?: string;
  autoReconnect?: boolean;
  reconnectInterval?: number;
}