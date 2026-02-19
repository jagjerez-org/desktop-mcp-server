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

// Union of all command messages
export type CommandMessage = 
  | MouseMoveMessage
  | MouseClickMessage
  | KeyboardTypeMessage
  | KeyboardPressMessage;

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

// Union of all response messages
export type ResponseMessage = 
  | ResultMessage
  | ScreenInfoMessage
  | ErrorMessage;

// Union of all protocol messages
export type ProtocolMessage = CommandMessage | ResponseMessage;

// ===== Message Validation =====
export class ProtocolValidator {
  static isValidMessage(data: any): data is ProtocolMessage {
    return typeof data === 'object' && 
           data !== null && 
           typeof data.type === 'string';
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
}