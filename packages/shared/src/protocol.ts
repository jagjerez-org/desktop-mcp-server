/**
 * Simplified DataChannel Protocol for Desktop MCP Server
 */

import { MouseButton, MousePosition, ScreenInfo } from './types.js';

// ===== Base Message Structure =====
export interface BaseMessage {
  type: string;
  id?: string;
  timestamp?: number;
}

// ===== Input Commands (Server → Agent) =====
export interface MouseMoveMessage extends BaseMessage {
  type: 'mouse_move';
  x: number;
  y: number;
}

export interface MouseClickMessage extends BaseMessage {
  type: 'mouse_click';
  x?: number;
  y?: number;
  button: MouseButton;
  double?: boolean;
}

export interface KeyboardTypeMessage extends BaseMessage {
  type: 'keyboard_type';
  text: string;
}

export interface KeyboardPressMessage extends BaseMessage {
  type: 'keyboard_press';
  keys: string[];
}

export interface MouseDragMessage extends BaseMessage {
  type: 'mouse_drag';
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

export interface MouseScrollMessage extends BaseMessage {
  type: 'mouse_scroll';
  amount: number;
  x?: number;
  y?: number;
}

export interface KeyboardHoldMessage extends BaseMessage {
  type: 'keyboard_hold';
  key: string;
  action: 'down' | 'up';
}

export interface ClipboardReadMessage extends BaseMessage {
  type: 'clipboard_read';
}

export interface ClipboardWriteMessage extends BaseMessage {
  type: 'clipboard_write';
  text: string;
}

export interface ShellExecMessage extends BaseMessage {
  type: 'shell_exec';
  command: string;
  workingDirectory?: string;
  timeout?: number;
}

export interface GetScreenInfoMessage extends BaseMessage {
  type: 'get_screen_info';
}

// Union of all command messages
export type CommandMessage = 
  | MouseMoveMessage
  | MouseClickMessage
  | KeyboardTypeMessage
  | KeyboardPressMessage
  | MouseDragMessage
  | MouseScrollMessage
  | KeyboardHoldMessage
  | ClipboardReadMessage
  | ClipboardWriteMessage
  | ShellExecMessage
  | GetScreenInfoMessage;

// ===== Response Messages (Agent → Server) =====
export interface ResultMessage extends BaseMessage {
  type: 'result';
  id: string;
  success: boolean;
  data?: any;
  error?: string;
}

export interface ScreenInfoMessage extends BaseMessage {
  type: 'screen_info';
  screenInfo: ScreenInfo;
}

export interface ErrorMessage extends BaseMessage {
  type: 'error';
  error: string;
  originalMessageId?: string;
}

export interface ClipboardContentMessage extends BaseMessage {
  type: 'clipboard_content';
  text: string;
}

export interface ShellOutputMessage extends BaseMessage {
  type: 'shell_output';
  output: string;
  exitCode: number;
}

// Union of all response messages
export type ResponseMessage = 
  | ResultMessage
  | ScreenInfoMessage
  | ErrorMessage
  | ClipboardContentMessage
  | ShellOutputMessage;

// Ping/Pong for latency measurement
export interface PingMessage extends BaseMessage {
  type: 'ping';
}

export interface PongMessage extends BaseMessage {
  type: 'pong';
}

// Union of all protocol messages
export type ProtocolMessage = CommandMessage | ResponseMessage | PingMessage | PongMessage;

// ===== Message Validation =====
export class ProtocolValidator {
  static isValidMessage(data: any): data is ProtocolMessage {
    return typeof data === 'object' && 
           data !== null && 
           typeof data.type === 'string';
  }

  static isCommandMessage(data: any): data is CommandMessage {
    const commandTypes = [
      'mouse_move', 'mouse_click', 'mouse_drag', 'mouse_scroll',
      'keyboard_type', 'keyboard_press', 'keyboard_hold',
      'clipboard_read', 'clipboard_write', 'shell_exec', 'get_screen_info'
    ];
    return this.isValidMessage(data) && commandTypes.includes(data.type);
  }

  static isResponseMessage(data: any): data is ResponseMessage {
    const responseTypes = ['result', 'screen_info', 'error', 'clipboard_content', 'shell_output'];
    return this.isValidMessage(data) && responseTypes.includes(data.type);
  }

  static validateMousePosition(x: number, y: number): boolean {
    return typeof x === 'number' && typeof y === 'number' && 
           x >= 0 && y >= 0 && 
           Number.isFinite(x) && Number.isFinite(y);
  }

  static validateMouseButton(button: string): button is MouseButton {
    return ['left', 'right', 'middle'].includes(button);
  }

  static validateKeys(keys: any[]): boolean {
    return Array.isArray(keys) && 
           keys.every(key => typeof key === 'string' && key.length > 0);
  }
}

// ===== Message Builders =====
export class MessageBuilder {
  static mouseMove(x: number, y: number, id?: string): MouseMoveMessage {
    return {
      type: 'mouse_move',
      x,
      y,
      id,
      timestamp: Date.now()
    };
  }

  static mouseClick(button: MouseButton, x?: number, y?: number, double?: boolean, id?: string): MouseClickMessage {
    return {
      type: 'mouse_click',
      button,
      x,
      y,
      double,
      id,
      timestamp: Date.now()
    };
  }

  static keyboardType(text: string, id?: string): KeyboardTypeMessage {
    return {
      type: 'keyboard_type',
      text,
      id,
      timestamp: Date.now()
    };
  }

  static keyboardPress(keys: string[], id?: string): KeyboardPressMessage {
    return {
      type: 'keyboard_press',
      keys,
      id,
      timestamp: Date.now()
    };
  }

  static result(id: string, success: boolean, data?: any, error?: string): ResultMessage {
    return {
      type: 'result',
      id,
      success,
      data,
      error,
      timestamp: Date.now()
    };
  }

  static error(error: string, originalMessageId?: string, id?: string): ErrorMessage {
    return {
      type: 'error',
      error,
      originalMessageId,
      id,
      timestamp: Date.now()
    };
  }

  static mouseDrag(fromX: number, fromY: number, toX: number, toY: number, id?: string): MouseDragMessage {
    return {
      type: 'mouse_drag',
      fromX,
      fromY,
      toX,
      toY,
      id,
      timestamp: Date.now()
    };
  }

  static mouseScroll(amount: number, x?: number, y?: number, id?: string): MouseScrollMessage {
    return {
      type: 'mouse_scroll',
      amount,
      x,
      y,
      id,
      timestamp: Date.now()
    };
  }

  static keyboardHold(key: string, action: 'down' | 'up', id?: string): KeyboardHoldMessage {
    return {
      type: 'keyboard_hold',
      key,
      action,
      id,
      timestamp: Date.now()
    };
  }

  static clipboardRead(id?: string): ClipboardReadMessage {
    return {
      type: 'clipboard_read',
      id,
      timestamp: Date.now()
    };
  }

  static clipboardWrite(text: string, id?: string): ClipboardWriteMessage {
    return {
      type: 'clipboard_write',
      text,
      id,
      timestamp: Date.now()
    };
  }

  static shellExec(command: string, workingDirectory?: string, timeout?: number, id?: string): ShellExecMessage {
    return {
      type: 'shell_exec',
      command,
      workingDirectory,
      timeout,
      id,
      timestamp: Date.now()
    };
  }

  static getScreenInfo(id?: string): GetScreenInfoMessage {
    return {
      type: 'get_screen_info',
      id,
      timestamp: Date.now()
    };
  }

  static clipboardContent(text: string, id?: string): ClipboardContentMessage {
    return {
      type: 'clipboard_content',
      text,
      id,
      timestamp: Date.now()
    };
  }

  static shellOutput(output: string, exitCode: number, id?: string): ShellOutputMessage {
    return {
      type: 'shell_output',
      output,
      exitCode,
      id,
      timestamp: Date.now()
    };
  }
}