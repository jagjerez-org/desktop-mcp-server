/**
 * Desktop MCP Server
 * 
 * Implements all MCP tools for remote desktop control via WebRTC:
 * - Connection management
 * - Screen capture
 * - Mouse and keyboard input
 * - Audio communication
 * - File transfers
 * - Shell execution
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { 
  MessageBuilder,
  FrameCapture,
  ConnectionStatus,
  ProtocolValidator,
  CommandMessage,
  MouseButton
} from '@desktop-mcp/shared';
import { WebRTCClient } from './webrtc-client.js';
import { SignalingServer, ConnectedAgent } from './signaling.js';
import { AuthManager } from './auth.js';

export class DesktopMCPServer {
  private server: Server;
  private authManager: AuthManager;
  private signalingServer: SignalingServer;
  private webrtcClients = new Map<string, WebRTCClient>();
  private currentDeviceId: string | null = null;

  constructor() {
    this.server = new Server({
      name: 'desktop-mcp-server',
      version: '1.0.0'
    }, {
      capabilities: {
        tools: {}
      }
    });

    this.authManager = new AuthManager();
    this.signalingServer = new SignalingServer(8080, this.authManager);
    
    this.setupEventHandlers();
    this.setupMCPServer();
  }

  private setupEventHandlers(): void {
    // Handle agent connections
    this.signalingServer.onConnect((agent: ConnectedAgent) => {
      console.log(`🔗 Desktop agent connected: ${agent.deviceInfo.deviceName}`);
      
      // Create WebRTC client for this agent
      const webrtcClient = new WebRTCClient(agent.deviceId);
      this.webrtcClients.set(agent.deviceId, webrtcClient);

      // Handle WebRTC events
      webrtcClient.onConnect((state) => {
        console.log(`✅ WebRTC connected to ${agent.deviceInfo.deviceName}`);
      });

      webrtcClient.onMessage((message) => {
        console.log(`📨 Received message from ${agent.deviceId}:`, message.type);
      });

      webrtcClient.onErrorHandler((error) => {
        console.error(`❌ WebRTC error for ${agent.deviceId}:`, error);
      });
    });

    // Handle agent disconnections
    this.signalingServer.onDisconnect((deviceId: string) => {
      const client = this.webrtcClients.get(deviceId);
      if (client) {
        client.close();
        this.webrtcClients.delete(deviceId);
      }
      
      if (this.currentDeviceId === deviceId) {
        this.currentDeviceId = null;
      }
    });

    // Handle signaling messages
    this.signalingServer.onMessage(async (deviceId: string, message) => {
      const client = this.webrtcClients.get(deviceId);
      if (!client) return;

      try {
        switch (message.type) {
          case 'offer':
            const answer = await client.createOffer();
            this.signalingServer.sendToAgent(deviceId, {
              type: 'answer',
              data: answer
            });
            break;
          
          case 'answer':
            await client.handleAnswer(message.data);
            break;
          
          case 'ice-candidate':
            await client.handleIceCandidate(message.data);
            break;
        }
      } catch (error) {
        console.error(`❌ Error handling signaling message:`, error);
      }
    });
  }

  private setupMCPServer(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: this.getToolDefinitions()
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'desktop_connect':
            return await this.handleDesktopConnect(args);
          
          case 'desktop_disconnect':
            return await this.handleDesktopDisconnect(args);
          
          case 'desktop_status':
            return await this.handleDesktopStatus(args);
          
          case 'get_frame':
            return await this.handleGetFrame(args);
          
          case 'get_frames':
            return await this.handleGetFrames(args);
          
          case 'mouse_move':
            return await this.handleMouseMove(args);
          
          case 'mouse_click':
            return await this.handleMouseClick(args);
          
          case 'mouse_drag':
            return await this.handleMouseDrag(args);
          
          case 'mouse_scroll':
            return await this.handleMouseScroll(args);
          
          case 'keyboard_type':
            return await this.handleKeyboardType(args);
          
          case 'keyboard_press':
            return await this.handleKeyboardPress(args);
          
          case 'keyboard_hold':
            return await this.handleKeyboardHold(args);
          
          case 'clipboard_read':
            return await this.handleClipboardRead(args);
          
          case 'clipboard_write':
            return await this.handleClipboardWrite(args);
          
          case 'audio_speak':
            return await this.handleAudioSpeak(args);
          
          case 'audio_listen':
            return await this.handleAudioListen(args);
          
          case 'shell_exec':
            return await this.handleShellExec(args);
          
          case 'get_screen_info':
            return await this.handleGetScreenInfo(args);
          
          case 'file_transfer':
            return await this.handleFileTransfer(args);
          
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
          }],
          isError: true
        };
      }
    });
  }

  private getToolDefinitions(): Tool[] {
    return [
      {
        name: 'desktop_connect',
        description: 'Connect to a paired desktop agent',
        inputSchema: {
          type: 'object',
          properties: {
            deviceId: { type: 'string', description: 'Device ID to connect to' }
          },
          required: ['deviceId']
        }
      },
      {
        name: 'desktop_disconnect',
        description: 'Disconnect from current desktop agent',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'desktop_status',
        description: 'Get connection status, latency, and resolution',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'get_frame',
        description: 'Get latest video frame as base64 JPEG',
        inputSchema: {
          type: 'object',
          properties: {
            quality: { type: 'number', minimum: 1, maximum: 100, description: 'JPEG quality (1-100)' },
            format: { type: 'string', enum: ['jpeg', 'png'], description: 'Image format' }
          }
        }
      },
      {
        name: 'get_frames',
        description: 'Get N frames over a time period',
        inputSchema: {
          type: 'object',
          properties: {
            count: { type: 'number', minimum: 1, maximum: 10, description: 'Number of frames to get' },
            quality: { type: 'number', minimum: 1, maximum: 100, description: 'JPEG quality (1-100)' }
          },
          required: ['count']
        }
      },
      {
        name: 'mouse_move',
        description: 'Move mouse cursor to specified position',
        inputSchema: {
          type: 'object',
          properties: {
            x: { type: 'number', description: 'X coordinate' },
            y: { type: 'number', description: 'Y coordinate' }
          },
          required: ['x', 'y']
        }
      },
      {
        name: 'mouse_click',
        description: 'Click mouse button at specified position',
        inputSchema: {
          type: 'object',
          properties: {
            x: { type: 'number', description: 'X coordinate (optional, uses current position)' },
            y: { type: 'number', description: 'Y coordinate (optional, uses current position)' },
            button: { type: 'string', enum: ['left', 'right', 'middle'], description: 'Mouse button to click' },
            double: { type: 'boolean', description: 'Double-click' }
          },
          required: ['button']
        }
      },
      {
        name: 'mouse_drag',
        description: 'Drag from one position to another',
        inputSchema: {
          type: 'object',
          properties: {
            fromX: { type: 'number', description: 'Start X coordinate' },
            fromY: { type: 'number', description: 'Start Y coordinate' },
            toX: { type: 'number', description: 'End X coordinate' },
            toY: { type: 'number', description: 'End Y coordinate' }
          },
          required: ['fromX', 'fromY', 'toX', 'toY']
        }
      },
      {
        name: 'mouse_scroll',
        description: 'Scroll mouse wheel',
        inputSchema: {
          type: 'object',
          properties: {
            amount: { type: 'number', description: 'Scroll amount (positive = up, negative = down)' },
            x: { type: 'number', description: 'X coordinate (optional)' },
            y: { type: 'number', description: 'Y coordinate (optional)' }
          },
          required: ['amount']
        }
      },
      {
        name: 'keyboard_type',
        description: 'Type text string',
        inputSchema: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'Text to type' }
          },
          required: ['text']
        }
      },
      {
        name: 'keyboard_press',
        description: 'Press key combination',
        inputSchema: {
          type: 'object',
          properties: {
            keys: { 
              type: 'array', 
              items: { type: 'string' },
              description: 'Keys to press (e.g., ["ctrl", "c"])' 
            }
          },
          required: ['keys']
        }
      },
      {
        name: 'keyboard_hold',
        description: 'Hold or release a key',
        inputSchema: {
          type: 'object',
          properties: {
            key: { type: 'string', description: 'Key to hold/release' },
            action: { type: 'string', enum: ['down', 'up'], description: 'Hold down or release' }
          },
          required: ['key', 'action']
        }
      },
      {
        name: 'clipboard_read',
        description: 'Read clipboard content',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'clipboard_write',
        description: 'Write to clipboard',
        inputSchema: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'Text to write to clipboard' }
          },
          required: ['text']
        }
      },
      {
        name: 'audio_speak',
        description: 'Send audio/TTS to desktop speakers',
        inputSchema: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'Text to speak (TTS)' },
            audioData: { type: 'string', description: 'Base64 encoded audio data' },
            format: { type: 'string', enum: ['opus', 'pcm'], description: 'Audio format' }
          }
        }
      },
      {
        name: 'audio_listen',
        description: 'Record from desktop microphone',
        inputSchema: {
          type: 'object',
          properties: {
            duration: { type: 'number', description: 'Recording duration in seconds (0 for continuous)' }
          }
        }
      },
      {
        name: 'shell_exec',
        description: 'Execute command on desktop',
        inputSchema: {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'Command to execute' },
            timeout: { type: 'number', description: 'Timeout in seconds' },
            workingDirectory: { type: 'string', description: 'Working directory' }
          },
          required: ['command']
        }
      },
      {
        name: 'get_screen_info',
        description: 'Get screen resolution and cursor position',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'file_transfer',
        description: 'Send or receive files via DataChannel',
        inputSchema: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['upload', 'download'], description: 'Transfer direction' },
            filename: { type: 'string', description: 'Filename' },
            data: { type: 'string', description: 'Base64 encoded file data (for upload)' },
            remotePath: { type: 'string', description: 'Remote file path (for download)' }
          },
          required: ['action', 'filename']
        }
      }
    ];
  }

  // Tool handler implementations
  private async handleDesktopConnect(args: any) {
    const { deviceId } = args;
    const agent = this.signalingServer.getConnectedAgent(deviceId);
    
    if (!agent) {
      throw new Error(`Device ${deviceId} not connected`);
    }

    this.currentDeviceId = deviceId;
    
    return {
      content: [{
        type: 'text',
        text: `Connected to ${agent.deviceInfo.deviceName} (${deviceId})`
      }]
    };
  }

  private async handleDesktopDisconnect(args: any) {
    if (!this.currentDeviceId) {
      throw new Error('No device currently connected');
    }

    const deviceId = this.currentDeviceId;
    this.currentDeviceId = null;
    
    this.signalingServer.disconnectAgent(deviceId, 'Disconnected by MCP client');
    
    return {
      content: [{
        type: 'text',
        text: `Disconnected from device ${deviceId}`
      }]
    };
  }

  private async handleDesktopStatus(args: any) {
    const agents = this.signalingServer.getConnectedAgents();
    const stats = this.signalingServer.getStats();
    
    let status = `Connected agents: ${agents.length}\n`;
    
    if (this.currentDeviceId) {
      const client = this.webrtcClients.get(this.currentDeviceId);
      if (client) {
        const clientStatus = client.getStatus();
        status += `\nCurrent connection:\n`;
        status += `- Device: ${this.currentDeviceId}\n`;
        status += `- Connected: ${clientStatus.isConnected}\n`;
        status += `- Latency: ${clientStatus.latency}ms\n`;
        status += `- Resolution: ${clientStatus.resolution?.width}x${clientStatus.resolution?.height}\n`;
      }
    }
    
    return {
      content: [{
        type: 'text',
        text: status
      }]
    };
  }

  private async handleGetFrame(args: any) {
    if (!this.currentDeviceId) {
      throw new Error('No device connected');
    }

    const client = this.webrtcClients.get(this.currentDeviceId);
    if (!client) {
      throw new Error('WebRTC client not available');
    }

    const { quality = 80, format = 'jpeg' } = args;
    let frame = client.getLatestFrame();
    
    if (!frame) {
      throw new Error('No frame available');
    }

    // Convert frame if needed
    if (format !== frame.format || quality !== frame.quality) {
      frame = await client.convertFrame(frame, format, quality);
    }

    return {
      content: [{
        type: 'text',
        text: `Frame captured: ${frame.width}x${frame.height} ${frame.format.toUpperCase()}`
      }, {
        type: 'image',
        data: frame.data,
        mimeType: `image/${frame.format}`
      }]
    };
  }

  private async handleGetFrames(args: any) {
    if (!this.currentDeviceId) {
      throw new Error('No device connected');
    }

    const client = this.webrtcClients.get(this.currentDeviceId);
    if (!client) {
      throw new Error('WebRTC client not available');
    }

    const { count, quality = 80 } = args;
    const frames = client.getFrames(count);
    
    if (frames.length === 0) {
      throw new Error('No frames available');
    }

    const content = [{
      type: 'text',
      text: `Captured ${frames.length} frames`
    }];

    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      content.push({
        type: 'image',
        data: frame.data,
        mimeType: `image/${frame.format}`
      });
    }

    return { content };
  }

  private async sendCommand(command: CommandMessage) {
    if (!this.currentDeviceId) {
      throw new Error('No device connected');
    }

    const client = this.webrtcClients.get(this.currentDeviceId);
    if (!client) {
      throw new Error('WebRTC client not available');
    }

    const success = client.sendCommand(command);
    if (!success) {
      throw new Error('Failed to send command');
    }

    return {
      content: [{
        type: 'text',
        text: `Command sent: ${command.type}`
      }]
    };
  }

  private async handleMouseMove(args: any) {
    const { x, y } = args;
    if (!ProtocolValidator.validateMousePosition(x, y)) {
      throw new Error('Invalid mouse position');
    }

    const command = MessageBuilder.mouseMove(x, y);
    return this.sendCommand(command);
  }

  private async handleMouseClick(args: any) {
    const { x, y, button, double } = args;
    if (!ProtocolValidator.validateMouseButton(button)) {
      throw new Error('Invalid mouse button');
    }

    const command = MessageBuilder.mouseClick(button as MouseButton, x, y, double);
    return this.sendCommand(command);
  }

  private async handleMouseDrag(args: any) {
    const { fromX, fromY, toX, toY } = args;
    const command = MessageBuilder.mouseDrag(fromX, fromY, toX, toY);
    return this.sendCommand(command);
  }

  private async handleMouseScroll(args: any) {
    const { amount, x, y } = args;
    const command = {
      type: 'mouse_scroll' as const,
      amount,
      x,
      y,
      timestamp: Date.now()
    };
    return this.sendCommand(command);
  }

  private async handleKeyboardType(args: any) {
    const { text } = args;
    const command = MessageBuilder.keyboardType(text);
    return this.sendCommand(command);
  }

  private async handleKeyboardPress(args: any) {
    const { keys } = args;
    if (!ProtocolValidator.validateKeys(keys)) {
      throw new Error('Invalid keys array');
    }

    const command = MessageBuilder.keyboardPress(keys);
    return this.sendCommand(command);
  }

  private async handleKeyboardHold(args: any) {
    const { key, action } = args;
    const command = {
      type: 'keyboard_hold' as const,
      key,
      action,
      timestamp: Date.now()
    };
    return this.sendCommand(command);
  }

  private async handleClipboardRead(args: any) {
    const command = {
      type: 'clipboard_read' as const,
      timestamp: Date.now()
    };
    return this.sendCommand(command);
  }

  private async handleClipboardWrite(args: any) {
    const { text } = args;
    const command = {
      type: 'clipboard_write' as const,
      text,
      timestamp: Date.now()
    };
    return this.sendCommand(command);
  }

  private async handleAudioSpeak(args: any) {
    // Audio implementation would go here
    throw new Error('Audio speak not implemented yet');
  }

  private async handleAudioListen(args: any) {
    // Audio implementation would go here
    throw new Error('Audio listen not implemented yet');
  }

  private async handleShellExec(args: any) {
    const { command, timeout, workingDirectory } = args;
    const shellCommand = {
      type: 'shell_exec' as const,
      command,
      workingDirectory,
      timeout,
      timestamp: Date.now()
    };
    return this.sendCommand(shellCommand);
  }

  private async handleGetScreenInfo(args: any) {
    const command = {
      type: 'get_screen_info' as const,
      timestamp: Date.now()
    };
    return this.sendCommand(command);
  }

  private async handleFileTransfer(args: any) {
    // File transfer implementation would go here
    throw new Error('File transfer not implemented yet');
  }

  /**
   * Start the MCP server
   */
  async start(): Promise<void> {
    console.log('🚀 Starting Desktop MCP Server...');
    
    // Start listening for stdio
    this.server.connect(process.stdin, process.stdout);
    
    console.log('✅ Desktop MCP Server started successfully');
    console.log('📡 Signaling server listening on port 8080');
    console.log('💡 Generate pairing code: const code = authManager.generatePairingCode()');
  }

  /**
   * Get pairing code for new device registration
   */
  generatePairingCode(): string {
    const pairingCode = this.authManager.generatePairingCode();
    console.log(`📱 Pairing code: ${pairingCode.code} (expires in 5 minutes)`);
    return pairingCode.code;
  }
}