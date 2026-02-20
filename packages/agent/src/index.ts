#!/usr/bin/env node

/**
 * Desktop Agent Entry Point
 * 
 * Starts the WebRTC desktop agent that connects to the MCP server
 */

import { program } from 'commander';
import * as fs from 'fs/promises';
import * as path from 'path';
import { SignalingClient } from './signaling-client.js';
import { AgentConfig } from '@jagjerez-org/desktop-mcp-shared';

// Default configuration
const DEFAULT_CONFIG: AgentConfig = {
  signalingUrl: 'ws://localhost:8080',
  deviceName: undefined, // Will be auto-generated
  autoReconnect: true,
  reconnectInterval: 5000,
  capture: {
    quality: 80,
    fps: 30
  }
};

class DesktopAgent {
  private signalingClient: SignalingClient;
  private config: AgentConfig;
  private configPath: string;
  private isRunning = false;

  constructor(configPath: string, config: AgentConfig) {
    this.configPath = configPath;
    this.config = config;
    this.signalingClient = new SignalingClient({
      signalingUrl: config.signalingUrl,
      deviceName: config.deviceName,
      autoReconnect: config.autoReconnect,
      reconnectInterval: config.reconnectInterval
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.signalingClient.onConnect(() => {
      console.log('🟢 Connected to MCP server');
    });

    this.signalingClient.onDisconnect(() => {
      console.log('🔴 Disconnected from MCP server');
    });

    this.signalingClient.onAuth((deviceInfo) => {
      console.log(`✅ Authenticated as: ${deviceInfo.deviceName} (${deviceInfo.deviceId})`);
      this.saveTokenIfNeeded();
    });

    this.signalingClient.onPairingRequired((callback) => {
      this.handlePairingRequired(callback);
    });

    this.signalingClient.onErrorHandler((error) => {
      console.error('❌ Agent error:', error.message);
    });

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down Desktop Agent...');
      this.stop();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\n🛑 Shutting down Desktop Agent...');
      this.stop();
      process.exit(0);
    });
  }

  private async handlePairingRequired(callback: (code: string) => void): Promise<void> {
    console.log('\n📱 Device pairing required!');
    console.log('Please enter the 6-digit pairing code displayed on the MCP server:');
    
    // In a real implementation, you might show a GUI dialog
    // For now, we'll prompt in the terminal
    process.stdout.write('Pairing code: ');
    
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    
    process.stdin.once('data', (input) => {
      const code = input.toString().trim();
      if (code.length === 6 && /^\d{6}$/.test(code)) {
        callback(code);
      } else {
        console.error('❌ Invalid pairing code format. Expected 6 digits.');
        process.exit(1);
      }
    });
  }

  private async saveTokenIfNeeded(): Promise<void> {
    try {
      const token = this.signalingClient.getToken();
      if (!token) return;

      // Update config with token
      const updatedConfig = { ...this.config, token };
      await fs.writeFile(this.configPath, JSON.stringify(updatedConfig, null, 2));
      console.log(`💾 Authentication token saved to ${this.configPath}`);
    } catch (error) {
      console.error('❌ Failed to save token:', error);
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('⚠️ Agent already running');
      return;
    }

    try {
      console.log('🚀 Starting Desktop Agent...');
      console.log(`📡 Connecting to: ${this.config.signalingUrl}`);
      console.log(`🖥️  Device name: ${this.config.deviceName || 'Auto-generated'}`);

      await this.signalingClient.connect();
      this.isRunning = true;

      console.log('✅ Desktop Agent started successfully');
      console.log('🔄 Agent running... Press Ctrl+C to stop');

    } catch (error) {
      console.error('❌ Failed to start Desktop Agent:', error);
      throw error;
    }
  }

  stop(): void {
    if (!this.isRunning) return;

    console.log('🛑 Stopping Desktop Agent...');
    this.signalingClient.disconnect();
    this.isRunning = false;
    console.log('✅ Desktop Agent stopped');
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      connection: this.signalingClient.getConnectionStatus(),
      config: this.config
    };
  }
}

async function loadConfig(configPath: string): Promise<AgentConfig> {
  try {
    const configData = await fs.readFile(configPath, 'utf8');
    const config = JSON.parse(configData);
    
    // Merge with defaults
    return { ...DEFAULT_CONFIG, ...config };
  } catch (error) {
    // Config file doesn't exist or is invalid, use defaults
    console.log(`📋 Using default configuration (${configPath} not found)`);
    return DEFAULT_CONFIG;
  }
}

async function saveDefaultConfig(configPath: string): Promise<void> {
  try {
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2));
    console.log(`📋 Default configuration saved to ${configPath}`);
  } catch (error) {
    console.error('❌ Failed to save default config:', error);
  }
}

async function main() {
  program
    .name('desktop-mcp-agent')
    .description('Desktop agent for WebRTC-based MCP server')
    .version('1.0.0')
    .option('-c, --config <path>', 'Configuration file path', './desktop-agent-config.json')
    .option('-s, --server <url>', 'Signaling server URL', 'ws://localhost:8080')
    .option('-n, --name <name>', 'Device name')
    .option('--init', 'Initialize default configuration file')
    .option('--status', 'Show agent status and exit')
    .parse();

  const options = program.opts();
  const configPath = path.resolve(options.config);

  // Handle special commands
  if (options.init) {
    await saveDefaultConfig(configPath);
    return;
  }

  // Load configuration
  let config = await loadConfig(configPath);

  // Override config with command line options
  if (options.server) {
    config.signalingUrl = options.server;
  }
  if (options.name) {
    config.deviceName = options.name;
  }

  // Create and start agent
  const agent = new DesktopAgent(configPath, config);

  if (options.status) {
    const status = agent.getStatus();
    console.log('📊 Desktop Agent Status:');
    console.log(JSON.stringify(status, null, 2));
    return;
  }

  try {
    await agent.start();
    
    // Keep the process alive
    process.stdin.resume();
    
  } catch (error) {
    console.error('❌ Failed to start Desktop Agent:', error);
    process.exit(1);
  }
}

// Handle unhandled errors
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled rejection:', error);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  process.exit(1);
});

main().catch((error) => {
  console.error('❌ Main error:', error);
  process.exit(1);
});