# desktop-mcp-server

MCP server for remote desktop control via WebRTC. Enables LLMs to see screens, move mouse, type text, execute commands, and more on remote desktops.

## Installation

```bash
npm install -g desktop-mcp-server
```

## Quick Start

### As MCP Server (stdio)

Add to your MCP client config (Claude Desktop, Cursor, etc.):

```json
{
  "mcpServers": {
    "desktop": {
      "command": "desktop-mcp-server"
    }
  }
}
```

### Programmatic

```typescript
import { DesktopMCPServer } from 'desktop-mcp-server';

const server = new DesktopMCPServer();
await server.start();
```

## Tools

| Tool | Description |
|------|-------------|
| `desktop_connect` | Connect to a paired desktop agent |
| `desktop_disconnect` | Disconnect from current agent |
| `desktop_status` | Get connection status, latency, resolution |
| `get_frame` | Capture screen as base64 JPEG/PNG |
| `get_frames` | Capture multiple frames |
| `get_screen_info` | Get resolution and cursor position |
| `mouse_move` | Move cursor to (x, y) |
| `mouse_click` | Click at position (left/right/middle, double) |
| `mouse_drag` | Drag from A to B |
| `mouse_scroll` | Scroll wheel |
| `keyboard_type` | Type text string |
| `keyboard_press` | Press key combo (e.g. Ctrl+C) |
| `keyboard_hold` | Hold/release a key |
| `clipboard_read` | Read clipboard content |
| `clipboard_write` | Write to clipboard |
| `shell_exec` | Execute shell command |
| `audio_speak` | TTS on remote desktop |
| `audio_listen` | Record from microphone |
| `file_transfer` | Send/receive files |

## Architecture

```
LLM Client → MCP Server (stdio) → WebRTC → Desktop Agent
```

The server exposes MCP tools and connects to desktop agents via WebRTC for real-time screen streaming and input control.

## Companion Packages

- [desktop-mcp-agent](https://www.npmjs.com/package/desktop-mcp-agent) — Install on the PC you want to control
- [desktop-mcp-shared](https://www.npmjs.com/package/desktop-mcp-shared) — Shared protocol types

## License

MIT
