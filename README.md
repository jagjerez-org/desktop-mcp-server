# Desktop MCP Server 🖥️

MCP (Model Context Protocol) server that gives AI agents full control of your desktop — screen capture, mouse, keyboard, clipboard, and shell commands.

## Tools

| Tool | Description |
|------|-------------|
| `screenshot` | Capture screen (full or cropped region), returns base64 JPEG |
| `mouse_move` | Move cursor to (x, y) |
| `mouse_click` | Click left/right/middle, single or double |
| `mouse_drag` | Drag from point A to point B |
| `mouse_scroll` | Scroll up/down |
| `keyboard_type` | Type a text string |
| `keyboard_press` | Press key combo (e.g. Ctrl+C, Alt+Tab) |
| `get_cursor_position` | Get current cursor (x, y) |
| `get_screen_size` | Get screen dimensions |
| `clipboard_read` | Read clipboard text |
| `clipboard_write` | Write text to clipboard |
| `run_command` | Execute shell command |

## Install

```bash
npm install
npm run build
```

## Usage

### Stdio (local, default)
```bash
node dist/index.js
```

### HTTP (remote access)
```bash
node dist/index.js --transport=http --port=3100 --api-key=mysecretkey
```

### HTTPS (remote + TLS)
```bash
node dist/index.js --transport=https --port=3100 --api-key=mysecretkey --cert=cert.pem --key=key.pem
```

### Environment Variables
- `MCP_API_KEY` — API key for authentication (alternative to `--api-key`)

### Claude Desktop (stdio)

```json
{
  "mcpServers": {
    "desktop": {
      "command": "node",
      "args": ["/path/to/desktop-mcp-server/dist/index.js"]
    }
  }
}
```

### OpenClaw (remote HTTP)

```yaml
mcp:
  servers:
    desktop:
      url: http://YOUR_PC_IP:3100/mcp
      headers:
        Authorization: Bearer mysecretkey
```

## Platform Support

| Feature | Linux | macOS | Windows |
|---------|-------|-------|---------|
| Screenshot | ✅ | ✅ | ✅ |
| Mouse | ✅ | ✅ | ✅ |
| Keyboard | ✅ | ✅ | ✅ |
| Clipboard | ✅ (xclip) | ✅ | ✅ |

### Linux Requirements
```bash
sudo apt install xclip libxtst-dev
```

## Security 🔐

### Pairing-Based Authentication

The server uses a **Bluetooth-style pairing** flow:

1. **Start the server** → first time it auto-generates a 6-digit pairing code (shown in console)
2. **Client sends the code** to `POST /pair` with a device name
3. **Server returns a token** (prefix `dmcp_`) — store it securely
4. **All future requests** use `Authorization: Bearer dmcp_...`
5. **Revoke anytime** via `DELETE /devices/{id}` or `DELETE /devices/all`

```bash
# Pair a new device
curl -X POST http://localhost:3100/pair \
  -H "Content-Type: application/json" \
  -d '{"code": "123456", "name": "jarvis-openclaw"}'

# List paired devices (requires auth)
curl http://localhost:3100/devices \
  -H "Authorization: Bearer dmcp_..."

# Generate new pairing code (requires auth)
curl -X POST http://localhost:3100/devices/pair \
  -H "Authorization: Bearer dmcp_..."

# Revoke a device
curl -X DELETE http://localhost:3100/devices/{deviceId} \
  -H "Authorization: Bearer dmcp_..."
```

### Token Storage
- Server secret: `~/.desktop-mcp/server.secret` (mode 0600)
- Paired tokens (hashed): `~/.desktop-mcp/tokens.json` (mode 0600)
- Tokens are HMAC-SHA256 hashed — raw tokens never stored on disk

### Legacy API Key
Still supported via `--api-key` for backward compatibility.

⚠️ This server gives full desktop control. Only run in trusted networks. Use HTTPS in production.

## License

MIT
