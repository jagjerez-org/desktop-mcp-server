# desktop-mcp-agent

Desktop agent that pairs with [desktop-mcp-server](https://www.npmjs.com/package/desktop-mcp-server) for AI-driven remote desktop control via WebRTC.

## Installation

```bash
npm install -g desktop-mcp-agent
```

## Quick Start

```bash
desktop-mcp-agent
```

The agent will:
1. Start and display a **pairing code**
2. Connect to the signaling server
3. Stream your screen via WebRTC
4. Execute mouse/keyboard/shell commands from the MCP server

## What it does

The agent runs on the desktop you want to control and handles:

- 🖥️ **Screen capture** — Captures and streams screen frames
- 🖱️ **Mouse control** — Moves, clicks, drags, scrolls
- ⌨️ **Keyboard input** — Types text, presses key combos
- 📋 **Clipboard** — Read/write clipboard content
- 💻 **Shell execution** — Runs commands locally
- 🔊 **Audio** — TTS playback and microphone recording
- 📁 **File transfer** — Send/receive files

## Architecture

```
LLM → desktop-mcp-server (MCP tools) → WebRTC → desktop-mcp-agent (this) → Your PC
```

## Requirements

- Node.js 18+
- Desktop environment (for screen capture and input injection)
- On Linux: `xdotool` for input simulation

## Security

The agent only accepts connections from authenticated MCP servers via pairing codes. All communication is encrypted via WebRTC (DTLS/SRTP).

⚠️ **Warning**: This gives remote control of your desktop. Only pair with trusted MCP servers.

## Companion Packages

- [desktop-mcp-server](https://www.npmjs.com/package/desktop-mcp-server) — MCP server (runs alongside the LLM)
- [desktop-mcp-shared](https://www.npmjs.com/package/desktop-mcp-shared) — Shared protocol types

## License

MIT
