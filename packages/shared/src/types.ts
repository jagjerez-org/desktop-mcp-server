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
export interface FrameCapture {
  data: string; // base64 encoded
  width: number;
  height: number;
  format: string;
  timestamp: number;
  quality?: number;
}

export interface AudioConfig {
  sampleRate?: number;
  channels?: number;
  bitDepth?: number;
}

export interface AudioData {
  data: Buffer;
  format: string;
  duration: number;
}

export interface DisplayInfo {
  id: number;
  name: string;
  width: number;
  height: number;
  primary: boolean;
}

export interface ShellResult {
  output: string;
  exitCode: number;
}

export type RTCConnectionState = 'new' | 'connecting' | 'connected' | 'disconnected' | 'failed' | 'closed';

export interface RTCConnectionInfo {
  connectionState: string;
  iceConnectionState: string;
  signalingState: string;
  localDescription: any;
  remoteDescription: any;
}

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
  displays?: DisplayInfo[];
}

export interface ConnectionStatus {
  isConnected: boolean;
  latency?: number;
  lastActivity: number;
  resolution?: { width: number; height: number };
  frameRate?: number;
  deviceInfo?: DeviceInfo;
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
  capture?: { fps?: number; quality?: number };
}