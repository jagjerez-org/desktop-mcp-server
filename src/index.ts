#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  mouse,
  keyboard,
  screen,
  Button,
  Key,
  Point,
  straightTo,
  centerOf,
  Region,
} from "@nut-tree-fork/nut-js";
import screenshot from "screenshot-desktop";
import sharp from "sharp";
import { z } from "zod";
import { randomUUID } from "crypto";

// ── Configure nut.js ──────────────────────────────────
keyboard.config.autoDelayMs = 25;
mouse.config.autoDelayMs = 25;
mouse.config.mouseSpeed = 1500;

// ── Key mapping ───────────────────────────────────────
const KEY_MAP: Record<string, Key> = {
  enter: Key.Enter,
  return: Key.Enter,
  tab: Key.Tab,
  escape: Key.Escape,
  esc: Key.Escape,
  space: Key.Space,
  backspace: Key.Backspace,
  delete: Key.Delete,
  up: Key.Up,
  down: Key.Down,
  left: Key.Left,
  right: Key.Right,
  home: Key.Home,
  end: Key.End,
  pageup: Key.PageUp,
  pagedown: Key.PageDown,
  f1: Key.F1, f2: Key.F2, f3: Key.F3, f4: Key.F4,
  f5: Key.F5, f6: Key.F6, f7: Key.F7, f8: Key.F8,
  f9: Key.F9, f10: Key.F10, f11: Key.F11, f12: Key.F12,
  ctrl: Key.LeftControl, control: Key.LeftControl,
  alt: Key.LeftAlt, option: Key.LeftAlt,
  shift: Key.LeftShift,
  meta: Key.LeftSuper, cmd: Key.LeftSuper, win: Key.LeftSuper, super: Key.LeftSuper,
  capslock: Key.CapsLock,
  printscreen: Key.Print,
  insert: Key.Insert,
};

export function resolveKey(keyName: string): Key {
  const lower = keyName.toLowerCase();
  if (KEY_MAP[lower]) return KEY_MAP[lower];
  // Single character
  if (keyName.length === 1) {
    const upper = keyName.toUpperCase();
    if (upper in Key) return Key[upper as keyof typeof Key];
  }
  // Try direct match
  if (keyName in Key) return Key[keyName as keyof typeof Key];
  throw new Error(`Unknown key: ${keyName}`);
}

// ── Session Management ────────────────────────────────
interface ActiveSession {
  sessionId: string;
  deviceId: string;
  transport: any;
  server: McpServer;
  createdAt: Date;
  lastActivity: Date;
}

const activeSessions = new Map<string, ActiveSession>();

// ── Tool Registration Function ────────────────────────
function registerAllTools(server: McpServer) {
  // ── Tool: screenshot ──────────────────────────────────
  server.tool(
    "screenshot",
    "Capture the current screen and return as a base64 image. Optionally crop a region.",
    {
      quality: z.number().min(1).max(100).default(60).describe("JPEG quality (1-100)"),
      maxWidth: z.number().optional().describe("Max width to resize to (preserves aspect ratio)"),
      x: z.number().optional().describe("Crop region X"),
      y: z.number().optional().describe("Crop region Y"),
      width: z.number().optional().describe("Crop region width"),
      height: z.number().optional().describe("Crop region height"),
    },
    async ({ quality, maxWidth, x, y, width, height }) => {
      try {
        const imgBuffer = await screenshot({ format: "png" });
        let pipeline = sharp(imgBuffer);

        // Crop if specified
        if (x !== undefined && y !== undefined && width !== undefined && height !== undefined) {
          pipeline = pipeline.extract({ left: x, top: y, width, height });
        }

        // Resize if needed
        if (maxWidth) {
          pipeline = pipeline.resize({ width: maxWidth, withoutEnlargement: true });
        }

        const jpeg = await pipeline.jpeg({ quality }).toBuffer();
        const base64 = jpeg.toString("base64");

        return {
          content: [
            { type: "image", data: base64, mimeType: "image/jpeg" },
            { type: "text", text: `Screenshot captured (${jpeg.length} bytes)` },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Screenshot failed: ${err}` }] };
      }
    }
  );

  // ── Tool: mouse_move ──────────────────────────────────
  server.tool(
    "mouse_move",
    "Move the mouse cursor to absolute coordinates.",
    {
      x: z.number().describe("X coordinate"),
      y: z.number().describe("Y coordinate"),
    },
    async ({ x, y }) => {
      await mouse.setPosition(new Point(x, y));
      return { content: [{ type: "text", text: `Mouse moved to (${x}, ${y})` }] };
    }
  );

  // ── Tool: mouse_click ─────────────────────────────────
  server.tool(
    "mouse_click",
    "Click mouse button at current position or specified coordinates.",
    {
      button: z.enum(["left", "right", "middle"]).default("left"),
      x: z.number().optional().describe("Move to X before clicking"),
      y: z.number().optional().describe("Move to Y before clicking"),
      doubleClick: z.boolean().default(false),
    },
    async ({ button, x, y, doubleClick }) => {
      if (x !== undefined && y !== undefined) {
        await mouse.setPosition(new Point(x, y));
      }

      const btn = button === "right" ? Button.RIGHT : button === "middle" ? Button.MIDDLE : Button.LEFT;

      if (doubleClick) {
        await mouse.doubleClick(btn);
      } else {
        await mouse.click(btn);
      }

      const pos = await mouse.getPosition();
      return {
        content: [{ type: "text", text: `${doubleClick ? "Double-" : ""}Clicked ${button} at (${pos.x}, ${pos.y})` }],
      };
    }
  );

  // ── Tool: mouse_drag ──────────────────────────────────
  server.tool(
    "mouse_drag",
    "Drag from one position to another.",
    {
      fromX: z.number(),
      fromY: z.number(),
      toX: z.number(),
      toY: z.number(),
    },
    async ({ fromX, fromY, toX, toY }) => {
      await mouse.setPosition(new Point(fromX, fromY));
      await mouse.pressButton(Button.LEFT);
      await mouse.setPosition(new Point(toX, toY));
      await mouse.releaseButton(Button.LEFT);
      return { content: [{ type: "text", text: `Dragged from (${fromX},${fromY}) to (${toX},${toY})` }] };
    }
  );

  // ── Tool: mouse_scroll ────────────────────────────────
  server.tool(
    "mouse_scroll",
    "Scroll the mouse wheel.",
    {
      amount: z.number().describe("Scroll amount (positive=down, negative=up)"),
      x: z.number().optional(),
      y: z.number().optional(),
    },
    async ({ amount, x, y }) => {
      if (x !== undefined && y !== undefined) {
        await mouse.setPosition(new Point(x, y));
      }
      if (amount > 0) {
        await mouse.scrollDown(Math.abs(amount));
      } else {
        await mouse.scrollUp(Math.abs(amount));
      }
      return { content: [{ type: "text", text: `Scrolled ${amount > 0 ? "down" : "up"} ${Math.abs(amount)}` }] };
    }
  );

  // ── Tool: keyboard_type ───────────────────────────────
  server.tool(
    "keyboard_type",
    "Type text string using the keyboard.",
    {
      text: z.string().describe("Text to type"),
    },
    async ({ text }) => {
      await keyboard.type(text);
      return { content: [{ type: "text", text: `Typed: "${text}"` }] };
    }
  );

  // ── Tool: keyboard_press ──────────────────────────────
  server.tool(
    "keyboard_press",
    "Press one or more keys (supports modifiers). Examples: ['ctrl', 'c'] for Ctrl+C, ['enter'] for Enter.",
    {
      keys: z.array(z.string()).describe("Key names to press simultaneously"),
    },
    async ({ keys }) => {
      const resolved = keys.map(resolveKey);
      if (resolved.length === 1) {
        await keyboard.pressKey(resolved[0]!);
        await keyboard.releaseKey(resolved[0]!);
      } else {
        // Press all, then release in reverse
        for (const k of resolved) await keyboard.pressKey(k);
        for (const k of resolved.reverse()) await keyboard.releaseKey(k);
      }
      return { content: [{ type: "text", text: `Pressed: ${keys.join("+")}` }] };
    }
  );

  // ── Tool: get_cursor_position ─────────────────────────
  server.tool(
    "get_cursor_position",
    "Get the current mouse cursor position.",
    {},
    async () => {
      const pos = await mouse.getPosition();
      return { content: [{ type: "text", text: `Cursor at (${pos.x}, ${pos.y})` }] };
    }
  );

  // ── Tool: get_screen_size ─────────────────────────────
  server.tool(
    "get_screen_size",
    "Get the screen dimensions.",
    {},
    async () => {
      const w = await screen.width();
      const h = await screen.height();
      return { content: [{ type: "text", text: `Screen size: ${w}x${h}` }] };
    }
  );

  // ── Tool: clipboard_read ──────────────────────────────
  server.tool(
    "clipboard_read",
    "Read the current clipboard text content.",
    {},
    async () => {
      // Use xclip/pbpaste/powershell depending on platform
      const { execSync } = await import("child_process");
      let text = "";
      try {
        if (process.platform === "darwin") {
          text = execSync("pbpaste", { encoding: "utf-8" });
        } else if (process.platform === "win32") {
          text = execSync("powershell -command Get-Clipboard", { encoding: "utf-8" });
        } else {
          text = execSync("xclip -selection clipboard -o", { encoding: "utf-8" });
        }
      } catch {
        return { content: [{ type: "text", text: "Clipboard empty or not accessible" }] };
      }
      return { content: [{ type: "text", text: `Clipboard: ${text}` }] };
    }
  );

  // ── Tool: clipboard_write ─────────────────────────────
  server.tool(
    "clipboard_write",
    "Write text to the clipboard.",
    {
      text: z.string(),
    },
    async ({ text }) => {
      const { execSync } = await import("child_process");
      try {
        if (process.platform === "darwin") {
          execSync(`echo ${JSON.stringify(text)} | pbcopy`);
        } else if (process.platform === "win32") {
          execSync(`echo ${JSON.stringify(text)} | clip`);
        } else {
          execSync(`echo ${JSON.stringify(text)} | xclip -selection clipboard`);
        }
      } catch {
        return { content: [{ type: "text", text: "Failed to write to clipboard" }] };
      }
      return { content: [{ type: "text", text: `Wrote to clipboard: "${text.slice(0, 50)}..."` }] };
    }
  );

  // ── Tool: run_command ─────────────────────────────────
  server.tool(
    "run_command",
    "Execute a shell command and return output. Use with caution.",
    {
      command: z.string().describe("Shell command to execute"),
      timeout: z.number().default(10000).describe("Timeout in ms"),
    },
    async ({ command, timeout }) => {
      const { execSync } = await import("child_process");
      try {
        const output = execSync(command, {
          encoding: "utf-8",
          timeout,
          maxBuffer: 1024 * 1024,
        });
        return { content: [{ type: "text", text: output || "(no output)" }] };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.stderr || err.message}` }] };
      }
    }
  );

  // ── Tool: screen_stream ───────────────────────────────
  // Returns multiple sequential screenshots for "streaming" vision
  server.tool(
    "screen_stream",
    "Capture a burst of sequential screenshots for near-real-time vision. Returns multiple frames.",
    {
      frames: z.number().min(1).max(10).default(3).describe("Number of frames to capture"),
      intervalMs: z.number().min(100).max(5000).default(500).describe("Interval between frames in ms"),
      quality: z.number().min(1).max(100).default(40).describe("JPEG quality"),
      maxWidth: z.number().default(800).describe("Max width per frame"),
    },
    async ({ frames, intervalMs, quality, maxWidth }) => {
      const content: Array<{ type: "image"; data: string; mimeType: string } | { type: "text"; text: string }> = [];
      for (let i = 0; i < frames; i++) {
        if (i > 0) await new Promise((r) => setTimeout(r, intervalMs));
        try {
          const imgBuffer = await screenshot({ format: "png" });
          const jpeg = await sharp(imgBuffer)
            .resize({ width: maxWidth, withoutEnlargement: true })
            .jpeg({ quality })
            .toBuffer();
          content.push({ type: "image", data: jpeg.toString("base64"), mimeType: "image/jpeg" });
        } catch (err) {
          content.push({ type: "text", text: `Frame ${i} failed: ${err}` });
        }
      }
      content.push({ type: "text", text: `Captured ${frames} frames at ${intervalMs}ms intervals` });
      return { content };
    }
  );

  // ── Tool: audio_play ──────────────────────────────────
  server.tool(
    "audio_play",
    "Play audio through the computer speakers. Accepts a file path or text-to-speech.",
    {
      filePath: z.string().optional().describe("Path to audio file to play"),
      text: z.string().optional().describe("Text to speak via TTS (uses system TTS)"),
      volume: z.number().min(0).max(100).optional().describe("Volume percentage"),
    },
    async ({ filePath, text, volume }) => {
      const { execSync } = await import("child_process");
      try {
        if (volume !== undefined) {
          if (process.platform === "linux") {
            execSync(`pactl set-sink-volume @DEFAULT_SINK@ ${volume}%`);
          } else if (process.platform === "darwin") {
            execSync(`osascript -e "set volume output volume ${volume}"`);
          }
        }

        if (filePath) {
          if (process.platform === "linux") {
            execSync(`paplay "${filePath}" || aplay "${filePath}"`, { timeout: 30000 });
          } else if (process.platform === "darwin") {
            execSync(`afplay "${filePath}"`, { timeout: 30000 });
          } else {
            execSync(`powershell -c "(New-Object Media.SoundPlayer '${filePath}').PlaySync()"`, { timeout: 30000 });
          }
          return { content: [{ type: "text", text: `Played: ${filePath}` }] };
        }

        if (text) {
          if (process.platform === "linux") {
            execSync(`espeak-ng "${text.replace(/"/g, '\\"')}"`, { timeout: 15000 });
          } else if (process.platform === "darwin") {
            execSync(`say "${text.replace(/"/g, '\\"')}"`, { timeout: 15000 });
          } else {
            execSync(`powershell -c "Add-Type -AssemblyName System.Speech; (New-Object System.Speech.Synthesis.SpeechSynthesizer).Speak('${text}')"`, { timeout: 15000 });
          }
          return { content: [{ type: "text", text: `Spoke: "${text}"` }] };
        }

        return { content: [{ type: "text", text: "Provide filePath or text" }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Audio error: ${err}` }] };
      }
    }
  );

  // ── Tool: audio_record ────────────────────────────────
  server.tool(
    "audio_record",
    "Record audio from the computer microphone.",
    {
      durationSec: z.number().min(1).max(60).default(5).describe("Recording duration in seconds"),
      outputPath: z.string().default("/tmp/mcp-recording.wav").describe("Output file path"),
    },
    async ({ durationSec, outputPath }) => {
      const { execSync } = await import("child_process");
      try {
        if (process.platform === "linux") {
          execSync(`arecord -d ${durationSec} -f S16_LE -r 16000 -c 1 "${outputPath}"`, { timeout: (durationSec + 5) * 1000 });
        } else if (process.platform === "darwin") {
          execSync(`rec -r 16000 -c 1 "${outputPath}" trim 0 ${durationSec}`, { timeout: (durationSec + 5) * 1000 });
        } else {
          // Windows: use ffmpeg
          execSync(`ffmpeg -y -f dshow -i audio="Microphone" -t ${durationSec} -ar 16000 -ac 1 "${outputPath}"`, { timeout: (durationSec + 5) * 1000 });
        }
        const { statSync } = await import("fs");
        const size = statSync(outputPath).size;
        return { content: [{ type: "text", text: `Recorded ${durationSec}s → ${outputPath} (${size} bytes)` }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Record error: ${err}` }] };
      }
    }
  );

  // ── Tool: volume_control ──────────────────────────────
  server.tool(
    "volume_control",
    "Get or set system volume, or mute/unmute.",
    {
      action: z.enum(["get", "set", "mute", "unmute"]).default("get"),
      level: z.number().min(0).max(100).optional().describe("Volume level (for set)"),
    },
    async ({ action, level }) => {
      const { execSync } = await import("child_process");
      try {
        if (process.platform === "linux") {
          switch (action) {
            case "get": {
              const vol = execSync("pactl get-sink-volume @DEFAULT_SINK@ | grep -oP '\\d+%' | head -1", { encoding: "utf-8" }).trim();
              return { content: [{ type: "text", text: `Volume: ${vol}` }] };
            }
            case "set":
              execSync(`pactl set-sink-volume @DEFAULT_SINK@ ${level}%`);
              return { content: [{ type: "text", text: `Volume set to ${level}%` }] };
            case "mute":
              execSync("pactl set-sink-mute @DEFAULT_SINK@ 1");
              return { content: [{ type: "text", text: "Muted" }] };
            case "unmute":
              execSync("pactl set-sink-mute @DEFAULT_SINK@ 0");
              return { content: [{ type: "text", text: "Unmuted" }] };
          }
        } else if (process.platform === "darwin") {
          switch (action) {
            case "get": {
              const vol = execSync('osascript -e "output volume of (get volume settings)"', { encoding: "utf-8" }).trim();
              return { content: [{ type: "text", text: `Volume: ${vol}%` }] };
            }
            case "set":
              execSync(`osascript -e "set volume output volume ${level}"`);
              return { content: [{ type: "text", text: `Volume set to ${level}%` }] };
            case "mute":
              execSync('osascript -e "set volume with output muted"');
              return { content: [{ type: "text", text: "Muted" }] };
            case "unmute":
              execSync('osascript -e "set volume without output muted"');
              return { content: [{ type: "text", text: "Unmuted" }] };
          }
        }
        return { content: [{ type: "text", text: `Volume control not implemented for ${process.platform}` }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Volume error: ${err}` }] };
      }
    }
  );
}

function createMcpServer(): McpServer {
  const newServer = new McpServer({
    name: "desktop-mcp-server",
    version: "1.0.0",
  });

  registerAllTools(newServer);
  return newServer;
}

// ── Create default server for stdio mode ─────────────
const server = createMcpServer();

// ── Start ─────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const mode = args.find((a) => a.startsWith("--transport="))?.split("=")[1] ?? "stdio";
  const port = parseInt(args.find((a) => a.startsWith("--port="))?.split("=")[1] ?? "3100", 10);
  const host = args.find((a) => a.startsWith("--host="))?.split("=")[1] ?? "0.0.0.0";
  const apiKey = args.find((a) => a.startsWith("--api-key="))?.split("=")[1] ?? process.env.MCP_API_KEY;
  const certFile = args.find((a) => a.startsWith("--cert="))?.split("=")[1];
  const keyFile = args.find((a) => a.startsWith("--key="))?.split("=")[1];

  if (mode === "stdio") {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("🖥️ Desktop MCP Server running (stdio transport)");
    return;
  }

  // ── HTTP/HTTPS with Streamable HTTP transport ────────
  const { createServer } = await import("http");
  const httpsModule = await import("https");
  const { readFileSync } = await import("fs");
  const { StreamableHTTPServerTransport } = await import(
    "@modelcontextprotocol/sdk/server/streamableHttp.js"
  );
  const {
    initAuth,
    authenticate,
    startPairing,
    completePairing,
    listDevices,
    revokeDevice,
    revokeAll,
    isPairingActive,
  } = await import("./auth.js");

  initAuth();

  // Auto-start first pairing if no devices paired yet
  const existingDevices = listDevices();
  if (existingDevices.length === 0) {
    console.error("📱 No paired devices. Starting initial pairing...");
    startPairing(300); // 5 min for first pairing
  }

  const getClientIp = (req: any) =>
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ?? req.socket?.remoteAddress ?? "unknown";

  const readBody = (req: any): Promise<string> =>
    new Promise((resolve) => {
      let body = "";
      req.on("data", (c: Buffer) => (body += c.toString()));
      req.on("end", () => resolve(body));
    });

  const json = (res: any, status: number, data: any) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  };

  const handler = async (req: any, res: any) => {
    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Mcp-Session-Id");
    if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

    const url = req.url?.split("?")[0];

    // ── Public: health ──────────────────────────────
    if (url === "/health") {
      json(res, 200, {
        status: "ok",
        transport: mode,
        tools: 16,
        pairedDevices: listDevices().length,
        pairingActive: isPairingActive(),
        activeSessions: activeSessions.size,
      });
      return;
    }

    // ── Public: pair ────────────────────────────────
    if (url === "/pair" && req.method === "POST") {
      const body = JSON.parse(await readBody(req));
      const { code, name } = body;
      if (!code || !name) {
        json(res, 400, { error: "Provide 'code' and 'name'" });
        return;
      }
      const result = completePairing(code, name, getClientIp(req));
      if (!result) {
        json(res, 403, { error: "Invalid or expired pairing code" });
        return;
      }
      json(res, 200, {
        token: result.token,
        deviceId: result.deviceId,
        message: "Paired successfully. Store this token securely — it won't be shown again.",
      });
      return;
    }

    // ── Everything below requires auth ──────────────
    const device = authenticate(req);

    // Legacy: also accept static API key
    const legacyAuth = apiKey && req.headers["authorization"] === `Bearer ${apiKey}`;

    if (!device && !legacyAuth) {
      json(res, 401, { error: "Unauthorized. Pair first via POST /pair with a pairing code." });
      return;
    }

    // ── Authenticated: MCP ──────────────────────────
    if (url === "/mcp") {
      // Get or create session for this device
      const deviceId = device?.id || "legacy";
      const sessionId = req.headers["mcp-session-id"] as string || randomUUID();
      const sessionKey = `${deviceId}:${sessionId}`;
      
      let session = activeSessions.get(sessionKey);
      
      if (!session) {
        // Create new session-specific transport
        const sessionTransport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => sessionId,
        });
        
        // Create new server instance for this session
        const sessionServer = createMcpServer();
        await sessionServer.connect(sessionTransport);
        
        session = {
          sessionId,
          deviceId,
          transport: sessionTransport,
          server: sessionServer,
          createdAt: new Date(),
          lastActivity: new Date(),
        };
        
        activeSessions.set(sessionKey, session);
        console.error(`🔗 New MCP session created: ${sessionKey}`);
      }
      
      // Update last activity
      session.lastActivity = new Date();
      
      // Handle request with session-specific transport
      await session.transport.handleRequest(req, res);
      return;
    }

    // ── Authenticated: device management ────────────
    if (url === "/devices" && req.method === "GET") {
      json(res, 200, { 
        devices: listDevices(),
        activeSessions: Array.from(activeSessions.values()).map(s => ({
          sessionId: s.sessionId,
          deviceId: s.deviceId,
          createdAt: s.createdAt,
          lastActivity: s.lastActivity,
        }))
      });
      return;
    }

    if (url === "/devices/pair" && req.method === "POST") {
      const body = JSON.parse(await readBody(req));
      const ttl = body.ttlSeconds ?? 120;
      const code = startPairing(ttl);
      json(res, 200, { code, expiresIn: ttl, message: "Share this code with the device to pair." });
      return;
    }

    if (url?.startsWith("/devices/") && req.method === "DELETE") {
      const id = url.split("/")[2];
      if (id === "all") {
        const count = revokeAll();
        // Clear all sessions for revoked devices
        activeSessions.clear();
        json(res, 200, { revoked: count });
      } else {
        const ok = revokeDevice(id!);
        if (ok) {
          // Clear sessions for this device
          for (const [key, session] of activeSessions.entries()) {
            if (session.deviceId === id) {
              activeSessions.delete(key);
            }
          }
        }
        json(res, ok ? 200 : 404, ok ? { revoked: id } : { error: "Device not found" });
      }
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  };

  let httpServer;
  if (mode === "https" && certFile && keyFile) {
    const cert = readFileSync(certFile);
    const key = readFileSync(keyFile);
    httpServer = httpsModule.createServer({ cert, key }, handler);
    console.error(`🔒 Desktop MCP Server running on https://${host}:${port}/mcp`);
  } else {
    httpServer = createServer(handler);
    console.error(`🖥️ Desktop MCP Server running on http://${host}:${port}/mcp`);
  }

  if (apiKey) console.error("🔑 Legacy API key also accepted");
  console.error("🔐 Pairing-based auth enabled. Tokens stored in ~/.desktop-mcp/");

  httpServer.listen(port, host);
}

main().catch(console.error);