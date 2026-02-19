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

function resolveKey(keyName: string): Key {
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

// ── MCP Server ────────────────────────────────────────
const server = new McpServer({
  name: "desktop-mcp-server",
  version: "1.0.0",
});

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

// ── Start ─────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("🖥️ Desktop MCP Server running (stdio transport)");
}

main().catch(console.error);
