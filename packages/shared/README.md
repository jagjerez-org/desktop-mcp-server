# desktop-mcp-shared

Shared types and protocol definitions for the Desktop MCP Server and Agent.

## Installation

```bash
npm install desktop-mcp-shared
```

## What's included

- **Protocol types**: Command and response message types for mouse, keyboard, clipboard, shell, screen info
- **ProtocolValidator**: Validation utilities for protocol messages
- **MessageBuilder**: Factory for creating protocol messages
- **Types**: Connection status, frame capture, device info, signaling messages

## Usage

```typescript
import {
  ProtocolValidator,
  MessageBuilder,
  CommandMessage,
  ResponseMessage,
  FrameCapture,
  ConnectionStatus
} from 'desktop-mcp-shared';

// Validate a message
if (ProtocolValidator.isCommandMessage(data)) {
  // handle command
}

// Build a mouse click message
const click = MessageBuilder.mouseClick(100, 200, 'left');
```

## Part of

- [desktop-mcp-server](https://www.npmjs.com/package/desktop-mcp-server) — MCP server for LLM desktop control
- [desktop-mcp-agent](https://www.npmjs.com/package/desktop-mcp-agent) — Desktop agent (runs on target PC)
