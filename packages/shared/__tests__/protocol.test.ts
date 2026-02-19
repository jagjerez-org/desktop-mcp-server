import { describe, it, expect } from 'vitest';
import { 
  ProtocolValidator, 
  MessageBuilder,
  MouseClickMessage,
  KeyboardTypeMessage,
  ResultMessage 
} from '../src/protocol.js';

describe('ProtocolValidator', () => {
  it('should validate valid messages', () => {
    const message = { type: 'mouse_move', x: 100, y: 200 };
    expect(ProtocolValidator.isValidMessage(message)).toBe(true);
  });

  it('should reject invalid messages', () => {
    expect(ProtocolValidator.isValidMessage(null)).toBe(false);
    expect(ProtocolValidator.isValidMessage({})).toBe(false);
    expect(ProtocolValidator.isValidMessage({ x: 100 })).toBe(false);
  });

  it('should identify command messages', () => {
    const mouseMove = { type: 'mouse_move', x: 100, y: 200 };
    const result = { type: 'result', id: '123', success: true };
    
    expect(ProtocolValidator.isCommandMessage(mouseMove)).toBe(true);
    expect(ProtocolValidator.isCommandMessage(result)).toBe(false);
  });

  it('should identify response messages', () => {
    const mouseMove = { type: 'mouse_move', x: 100, y: 200 };
    const result = { type: 'result', id: '123', success: true };
    
    expect(ProtocolValidator.isResponseMessage(mouseMove)).toBe(false);
    expect(ProtocolValidator.isResponseMessage(result)).toBe(true);
  });

  it('should validate mouse positions', () => {
    expect(ProtocolValidator.validateMousePosition(100, 200)).toBe(true);
    expect(ProtocolValidator.validateMousePosition(-1, 200)).toBe(false);
    expect(ProtocolValidator.validateMousePosition(100, -1)).toBe(false);
    expect(ProtocolValidator.validateMousePosition(NaN, 200)).toBe(false);
    expect(ProtocolValidator.validateMousePosition(Infinity, 200)).toBe(false);
  });

  it('should validate mouse buttons', () => {
    expect(ProtocolValidator.validateMouseButton('left')).toBe(true);
    expect(ProtocolValidator.validateMouseButton('right')).toBe(true);
    expect(ProtocolValidator.validateMouseButton('middle')).toBe(true);
    expect(ProtocolValidator.validateMouseButton('invalid')).toBe(false);
  });

  it('should validate key arrays', () => {
    expect(ProtocolValidator.validateKeys(['ctrl', 'c'])).toBe(true);
    expect(ProtocolValidator.validateKeys(['shift', 'tab'])).toBe(true);
    expect(ProtocolValidator.validateKeys([])).toBe(true);
    expect(ProtocolValidator.validateKeys([''])).toBe(false);
    expect(ProtocolValidator.validateKeys([123])).toBe(false);
    expect(ProtocolValidator.validateKeys('not-an-array')).toBe(false);
  });
});

describe('MessageBuilder', () => {
  it('should build mouse move messages', () => {
    const message = MessageBuilder.mouseMove(100, 200, 'test-id');
    
    expect(message.type).toBe('mouse_move');
    expect(message.x).toBe(100);
    expect(message.y).toBe(200);
    expect(message.id).toBe('test-id');
    expect(message.timestamp).toBeTypeOf('number');
  });

  it('should build mouse click messages', () => {
    const message = MessageBuilder.mouseClick('left', 100, 200, false, 'test-id');
    
    expect(message.type).toBe('mouse_click');
    expect(message.button).toBe('left');
    expect(message.x).toBe(100);
    expect(message.y).toBe(200);
    expect(message.double).toBe(false);
    expect(message.id).toBe('test-id');
    expect(message.timestamp).toBeTypeOf('number');
  });

  it('should build mouse drag messages', () => {
    const message = MessageBuilder.mouseDrag(10, 20, 100, 200, 'test-id');
    
    expect(message.type).toBe('mouse_drag');
    expect(message.fromX).toBe(10);
    expect(message.fromY).toBe(20);
    expect(message.toX).toBe(100);
    expect(message.toY).toBe(200);
    expect(message.id).toBe('test-id');
  });

  it('should build keyboard type messages', () => {
    const message = MessageBuilder.keyboardType('hello world', 'test-id');
    
    expect(message.type).toBe('keyboard_type');
    expect(message.text).toBe('hello world');
    expect(message.id).toBe('test-id');
  });

  it('should build keyboard press messages', () => {
    const message = MessageBuilder.keyboardPress(['ctrl', 'c'], 'test-id');
    
    expect(message.type).toBe('keyboard_press');
    expect(message.keys).toEqual(['ctrl', 'c']);
    expect(message.id).toBe('test-id');
  });

  it('should build result messages', () => {
    const message = MessageBuilder.result('original-id', true, { success: true }, undefined);
    
    expect(message.type).toBe('result');
    expect(message.id).toBe('original-id');
    expect(message.success).toBe(true);
    expect(message.data).toEqual({ success: true });
    expect(message.error).toBeUndefined();
  });

  it('should build error messages', () => {
    const message = MessageBuilder.error('Something went wrong', 'original-id', 'error-id');
    
    expect(message.type).toBe('error');
    expect(message.error).toBe('Something went wrong');
    expect(message.originalMessageId).toBe('original-id');
    expect(message.id).toBe('error-id');
  });
});