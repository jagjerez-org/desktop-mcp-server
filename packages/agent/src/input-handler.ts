/**
 * Input Handler for Desktop Agent
 * 
 * Executes mouse and keyboard commands received via DataChannel
 * using @nut-tree-fork/nut-js
 */

import { mouse, keyboard, Key, Button, Point } from '@nut-tree-fork/nut-js';
import { exec } from 'child_process';
import { promisify } from 'util';
import clipboardy from 'clipboardy';
import { 
  CommandMessage, 
  ResponseMessage, 
  MessageBuilder,
  ScreenInfo,
  ShellResult,
  MouseButton 
} from '@jagjerez-org/desktop-mcp-shared';

const execAsync = promisify(exec);

export class InputHandler {
  private screenWidth = 1920;
  private screenHeight = 1080;

  constructor() {
    this.initializeMouseSettings();
  }

  private async initializeMouseSettings(): Promise<void> {
    try {
      // Configure mouse settings for better precision
      mouse.config.mouseSpeed = 1000; // pixels per second
      mouse.config.autoDelayMs = 10; // delay between actions
      
      // Get current screen dimensions
      const screenInfo = await this.getScreenInfo();
      this.screenWidth = screenInfo.width;
      this.screenHeight = screenInfo.height;
      
    } catch (error) {
      console.error('❌ Error initializing mouse settings:', error);
    }
  }

  /**
   * Handle incoming command message
   */
  async handleCommand(message: CommandMessage): Promise<ResponseMessage> {
    try {
      console.log(`🎮 Executing command: ${message.type}`);

      switch (message.type) {
        case 'mouse_move':
          await this.handleMouseMove(message.x, message.y);
          break;

        case 'mouse_click':
          await this.handleMouseClick(message.button, message.x, message.y, message.double);
          break;

        case 'mouse_drag':
          await this.handleMouseDrag(message.fromX, message.fromY, message.toX, message.toY);
          break;

        case 'mouse_scroll':
          await this.handleMouseScroll(message.amount, message.x, message.y);
          break;

        case 'keyboard_type':
          await this.handleKeyboardType(message.text);
          break;

        case 'keyboard_press':
          await this.handleKeyboardPress(message.keys);
          break;

        case 'keyboard_hold':
          await this.handleKeyboardHold(message.key, message.action);
          break;

        case 'clipboard_read':
          return await this.handleClipboardRead(message.id);

        case 'clipboard_write':
          await this.handleClipboardWrite(message.text);
          break;

        case 'shell_exec':
          return await this.handleShellExec(message);

        case 'get_screen_info':
          return await this.handleGetScreenInfo(message.id);

        default:
          throw new Error(`Unknown command type: ${(message as any).type}`);
      }

      // Return success response for commands that don't return specific data
      return MessageBuilder.result(message.id || 'unknown', true, { success: true });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Error executing command ${message.type}:`, errorMessage);
      return MessageBuilder.result(message.id || 'unknown', false, null, errorMessage);
    }
  }

  /**
   * Move mouse to specified position
   */
  private async handleMouseMove(x: number, y: number): Promise<void> {
    // Clamp coordinates to screen bounds
    const clampedX = Math.max(0, Math.min(this.screenWidth - 1, x));
    const clampedY = Math.max(0, Math.min(this.screenHeight - 1, y));
    
    const point = new Point(clampedX, clampedY);
    await mouse.move([point]);
    console.log(`🖱️ Mouse moved to (${clampedX}, ${clampedY})`);
  }

  /**
   * Click mouse button at position
   */
  private async handleMouseClick(
    button: MouseButton, 
    x?: number, 
    y?: number, 
    double?: boolean
  ): Promise<void> {
    // Move to position if specified
    if (x !== undefined && y !== undefined) {
      await this.handleMouseMove(x, y);
    }

    // Convert button type
    const nutButton = this.convertMouseButton(button);
    
    if (double) {
      await mouse.doubleClick(nutButton);
      console.log(`🖱️ Double-clicked ${button} button`);
    } else {
      await mouse.click(nutButton);
      console.log(`🖱️ Clicked ${button} button`);
    }
  }

  /**
   * Drag from one position to another
   */
  private async handleMouseDrag(fromX: number, fromY: number, toX: number, toY: number): Promise<void> {
    const startPoint = new Point(fromX, fromY);
    const endPoint = new Point(toX, toY);
    
    await mouse.move([startPoint]);
    await mouse.pressButton(Button.LEFT);
    await mouse.move([endPoint]);
    await mouse.releaseButton(Button.LEFT);
    
    console.log(`🖱️ Dragged from (${fromX}, ${fromY}) to (${toX}, ${toY})`);
  }

  /**
   * Scroll mouse wheel
   */
  private async handleMouseScroll(amount: number, x?: number, y?: number): Promise<void> {
    // Move to position if specified
    if (x !== undefined && y !== undefined) {
      await this.handleMouseMove(x, y);
    }

    // Scroll (positive = up, negative = down)
    const direction = amount > 0 ? 'up' : 'down';
    const scrollAmount = Math.abs(amount);
    
    await mouse.scrollUp(scrollAmount);
    console.log(`🖱️ Scrolled ${direction} by ${scrollAmount}`);
  }

  /**
   * Type text string
   */
  private async handleKeyboardType(text: string): Promise<void> {
    await keyboard.type(text);
    console.log(`⌨️ Typed: ${text.length} characters`);
  }

  /**
   * Press key combination
   */
  private async handleKeyboardPress(keys: string[]): Promise<void> {
    const nutKeys = keys.map(key => this.convertKey(key));
    
    if (nutKeys.length === 1) {
      await keyboard.pressKey(nutKeys[0]);
    } else {
      // Handle key combinations (e.g., Ctrl+C)
      await keyboard.pressKey(...nutKeys);
    }
    
    console.log(`⌨️ Pressed keys: ${keys.join('+')}`);
  }

  /**
   * Hold or release a key
   */
  private async handleKeyboardHold(key: string, action: 'down' | 'up'): Promise<void> {
    const nutKey = this.convertKey(key);
    
    if (action === 'down') {
      await keyboard.pressKey(nutKey);
    } else {
      await keyboard.releaseKey(nutKey);
    }
    
    console.log(`⌨️ Key ${key} ${action}`);
  }

  /**
   * Read clipboard content
   */
  private async handleClipboardRead(messageId?: string): Promise<ResponseMessage> {
    try {
      const text = await clipboardy.read();
      return {
        type: 'clipboard_content',
        text,
        id: messageId,
        timestamp: Date.now()
      };
    } catch (error) {
      return MessageBuilder.error(
        error instanceof Error ? error.message : 'Failed to read clipboard',
        messageId
      );
    }
  }

  /**
   * Write to clipboard
   */
  private async handleClipboardWrite(text: string): Promise<void> {
    await clipboardy.write(text);
    console.log(`📋 Wrote to clipboard: ${text.length} characters`);
  }

  /**
   * Execute shell command
   */
  private async handleShellExec(message: any): Promise<ResponseMessage> {
    const startTime = Date.now();
    
    try {
      const options: any = {
        timeout: (message.timeout || 30) * 1000, // Convert to ms
        maxBuffer: 1024 * 1024, // 1MB buffer
      };

      if (message.workingDirectory) {
        options.cwd = message.workingDirectory;
      }

      if (message.environment) {
        options.env = { ...process.env, ...message.environment };
      }

      const { stdout, stderr } = await execAsync(message.command, { ...options, encoding: 'utf-8' });
      
      const result: ShellResult = {
        output: String(stdout || ''),
        exitCode: 0
      };

      return {
        type: 'shell_output',
        output: result.output,
        exitCode: result.exitCode,
        id: message.id,
        timestamp: Date.now()
      };

    } catch (error: any) {
      const result: ShellResult = {
        output: error.stderr || error.message || 'Unknown error',
        exitCode: error.code || 1
      };

      return {
        type: 'shell_output',
        output: result.output,
        exitCode: result.exitCode,
        id: message.id,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Get screen information
   */
  private async handleGetScreenInfo(messageId?: string): Promise<ResponseMessage> {
    try {
      const screenInfo = await this.getScreenInfo();
      return {
        type: 'screen_info',
        screenInfo,
        id: messageId,
        timestamp: Date.now()
      };
    } catch (error) {
      return MessageBuilder.error(
        error instanceof Error ? error.message : 'Failed to get screen info',
        messageId
      );
    }
  }

  /**
   * Get current screen information
   */
  async getScreenInfo(): Promise<ScreenInfo> {
    try {
      // Get current mouse position
      const mousePos = await mouse.getPosition();
      
      // In a real implementation, you'd get actual screen dimensions
      // For now, use stored values
      return {
        width: this.screenWidth,
        height: this.screenHeight,
        cursorX: mousePos.x,
        cursorY: mousePos.y,
        scaleFactor: 1.0,
        displays: [{
          id: 0,
          name: 'Primary Display',
          width: this.screenWidth,
          height: this.screenHeight,
          primary: true
        }]
      };
    } catch (error) {
      console.error('❌ Error getting screen info:', error);
      throw error;
    }
  }

  /**
   * Convert mouse button string to nut.js Button
   */
  private convertMouseButton(button: MouseButton): Button {
    switch (button) {
      case 'left':
        return Button.LEFT;
      case 'right':
        return Button.RIGHT;
      case 'middle':
        return Button.MIDDLE;
      default:
        return Button.LEFT;
    }
  }

  /**
   * Convert key string to nut.js Key
   */
  private convertKey(key: string): Key {
    // Handle special keys
    const keyMap: { [key: string]: Key } = {
      // Modifiers
      'ctrl': Key.LeftControl,
      'control': Key.LeftControl,
      'alt': Key.LeftAlt,
      'shift': Key.LeftShift,
      'meta': Key.LeftSuper,
      'cmd': Key.LeftSuper,
      'super': Key.LeftSuper,
      'win': Key.LeftSuper,
      
      // Navigation
      'up': Key.Up,
      'down': Key.Down,
      'left': Key.Left,
      'right': Key.Right,
      'home': Key.Home,
      'end': Key.End,
      'pageup': Key.PageUp,
      'pagedown': Key.PageDown,
      
      // Function keys
      'f1': Key.F1,
      'f2': Key.F2,
      'f3': Key.F3,
      'f4': Key.F4,
      'f5': Key.F5,
      'f6': Key.F6,
      'f7': Key.F7,
      'f8': Key.F8,
      'f9': Key.F9,
      'f10': Key.F10,
      'f11': Key.F11,
      'f12': Key.F12,
      
      // Special keys
      'enter': Key.Return,
      'return': Key.Return,
      'tab': Key.Tab,
      'escape': Key.Escape,
      'esc': Key.Escape,
      'space': Key.Space,
      'backspace': Key.Backspace,
      'delete': Key.Delete,
      'insert': Key.Insert,
    };

    const normalizedKey = key.toLowerCase();
    
    if (keyMap[normalizedKey]) {
      return keyMap[normalizedKey];
    }

    // Handle single character keys
    if (key.length === 1) {
      return key.toUpperCase() as unknown as Key;
    }

    // Fallback - try to use the key as-is
    return key as unknown as Key;
  }
}