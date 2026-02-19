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

## Usage with Claude Desktop

Add to your `claude_desktop_config.json`:

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

## Usage with OpenClaw

Add to your gateway config:

```yaml
mcp:
  servers:
    desktop:
      command: node
      args:
        - /path/to/desktop-mcp-server/dist/index.js
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

## Security ⚠️

This server gives full desktop control. Only run it in trusted environments. The `run_command` tool can execute arbitrary shell commands.

## License

MIT
