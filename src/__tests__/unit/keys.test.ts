import { describe, it, expect, vi } from 'vitest';

// Mock the entire nut-js module to avoid native dependency issues
const mockKeyEnum = {} as any;

// Add all letters A-Z
for (let i = 0; i < 26; i++) {
  const letter = String.fromCharCode(65 + i); // 'A' to 'Z'
  mockKeyEnum[letter] = letter;
}

// Add all numbers 0-9
for (let i = 0; i <= 9; i++) {
  mockKeyEnum[`Num${i}`] = `Num${i}`;
}

// Add other keys
Object.assign(mockKeyEnum, {
  Enter: 'Enter',
  Tab: 'Tab',
  Escape: 'Escape',
  Space: 'Space',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Up: 'Up',
  Down: 'Down',
  Left: 'Left',
  Right: 'Right',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  F1: 'F1',
  F2: 'F2',
  F3: 'F3',
  F4: 'F4',
  F5: 'F5',
  F6: 'F6',
  F7: 'F7',
  F8: 'F8',
  F9: 'F9',
  F10: 'F10',
  F11: 'F11',
  F12: 'F12',
  LeftControl: 'LeftControl',
  RightControl: 'RightControl',
  LeftAlt: 'LeftAlt',
  LeftShift: 'LeftShift',
  LeftSuper: 'LeftSuper',
  CapsLock: 'CapsLock',
  Print: 'Print',
  Insert: 'Insert',
});

vi.mock('@nut-tree-fork/nut-js', () => ({
  Key: mockKeyEnum,
  mouse: { config: {} },
  keyboard: { config: {} },
  screen: {},
  Button: {},
  Point: class Point { constructor(public x: number, public y: number) {} },
}));

const { Key } = await import('@nut-tree-fork/nut-js');
const { resolveKey } = await import('../../index.js');

describe('Key Resolution', () => {
  describe('resolveKey', () => {
    it('should resolve known key names (lowercase)', () => {
      expect(resolveKey('enter')).toBe(Key.Enter);
      expect(resolveKey('return')).toBe(Key.Enter);
      expect(resolveKey('tab')).toBe(Key.Tab);
      expect(resolveKey('escape')).toBe(Key.Escape);
      expect(resolveKey('esc')).toBe(Key.Escape);
      expect(resolveKey('space')).toBe(Key.Space);
      expect(resolveKey('backspace')).toBe(Key.Backspace);
      expect(resolveKey('delete')).toBe(Key.Delete);
    });

    it('should resolve arrow keys', () => {
      expect(resolveKey('up')).toBe(Key.Up);
      expect(resolveKey('down')).toBe(Key.Down);
      expect(resolveKey('left')).toBe(Key.Left);
      expect(resolveKey('right')).toBe(Key.Right);
    });

    it('should resolve navigation keys', () => {
      expect(resolveKey('home')).toBe(Key.Home);
      expect(resolveKey('end')).toBe(Key.End);
      expect(resolveKey('pageup')).toBe(Key.PageUp);
      expect(resolveKey('pagedown')).toBe(Key.PageDown);
    });

    it('should resolve function keys', () => {
      expect(resolveKey('f1')).toBe(Key.F1);
      expect(resolveKey('f2')).toBe(Key.F2);
      expect(resolveKey('f12')).toBe(Key.F12);
    });

    it('should resolve modifier keys', () => {
      expect(resolveKey('ctrl')).toBe(Key.LeftControl);
      expect(resolveKey('control')).toBe(Key.LeftControl);
      expect(resolveKey('alt')).toBe(Key.LeftAlt);
      expect(resolveKey('option')).toBe(Key.LeftAlt);
      expect(resolveKey('shift')).toBe(Key.LeftShift);
      expect(resolveKey('meta')).toBe(Key.LeftSuper);
      expect(resolveKey('cmd')).toBe(Key.LeftSuper);
      expect(resolveKey('win')).toBe(Key.LeftSuper);
      expect(resolveKey('super')).toBe(Key.LeftSuper);
    });

    it('should resolve special keys', () => {
      expect(resolveKey('capslock')).toBe(Key.CapsLock);
      expect(resolveKey('printscreen')).toBe(Key.Print);
      expect(resolveKey('insert')).toBe(Key.Insert);
    });

    it('should resolve single character keys', () => {
      expect(resolveKey('a')).toBe(Key.A);
      expect(resolveKey('A')).toBe(Key.A);
      expect(resolveKey('z')).toBe(Key.Z);
      expect(resolveKey('Z')).toBe(Key.Z);
      
      // Number keys should throw error because they're not in the direct mapping
      // The actual implementation doesn't have a special case for number characters
      expect(() => resolveKey('1')).toThrow('Unknown key: 1');
      expect(() => resolveKey('9')).toThrow('Unknown key: 9');
      expect(() => resolveKey('0')).toThrow('Unknown key: 0');
    });

    it('should be case-insensitive for mapped keys', () => {
      expect(resolveKey('ENTER')).toBe(Key.Enter);
      expect(resolveKey('Enter')).toBe(Key.Enter);
      expect(resolveKey('CTRL')).toBe(Key.LeftControl);
      expect(resolveKey('Ctrl')).toBe(Key.LeftControl);
    });

    it('should resolve direct Key enum matches', () => {
      expect(resolveKey('Enter')).toBe(Key.Enter);
      expect(resolveKey('LeftControl')).toBe(Key.LeftControl);
      expect(resolveKey('RightControl')).toBe(Key.RightControl);
    });

    it('should throw error for unknown keys', () => {
      expect(() => resolveKey('unknown')).toThrow('Unknown key: unknown');
      expect(() => resolveKey('invalid')).toThrow('Unknown key: invalid');
      expect(() => resolveKey('fake_key')).toThrow('Unknown key: fake_key');
    });

    it('should throw error for empty string', () => {
      expect(() => resolveKey('')).toThrow('Unknown key: ');
    });

    it('should throw error for multi-character non-mapped keys', () => {
      expect(() => resolveKey('abc')).toThrow('Unknown key: abc');
      expect(() => resolveKey('123')).toThrow('Unknown key: 123');
    });

    it('should handle special characters', () => {
      // Single space character is not in the KEY_MAP, so it should throw
      expect(() => resolveKey(' ')).toThrow('Unknown key:  ');
      // Only 'space' (the word) is mapped to Key.Space
      expect(resolveKey('space')).toBe(Key.Space);
    });

    it('should resolve number keys correctly', () => {
      // Number character keys are not directly mapped, they should throw
      for (let i = 0; i <= 9; i++) {
        const keyName = i.toString();
        expect(() => resolveKey(keyName)).toThrow(`Unknown key: ${keyName}`);
      }
    });

    it('should resolve letter keys correctly', () => {
      for (let i = 0; i < 26; i++) {
        const letter = String.fromCharCode(97 + i); // 'a' to 'z'
        const expectedKey = Key[letter.toUpperCase() as keyof typeof Key];
        expect(resolveKey(letter)).toBe(expectedKey);
        expect(resolveKey(letter.toUpperCase())).toBe(expectedKey);
      }
    });
  });

  describe('Edge cases', () => {
    it('should handle whitespace in key names', () => {
      // The function doesn't trim, so this should fail
      expect(() => resolveKey(' enter')).toThrow();
      expect(() => resolveKey('enter ')).toThrow();
      expect(() => resolveKey(' ')).toThrow(); // Single space is not valid
    });

    it('should maintain behavior consistency', () => {
      // Test that the same input always gives the same output
      const testKeys = ['enter', 'a', 'ctrl', 'f1'];
      
      testKeys.forEach(keyName => {
        const result1 = resolveKey(keyName);
        const result2 = resolveKey(keyName);
        expect(result1).toBe(result2);
      });
      
      // Test that invalid keys consistently throw
      expect(() => resolveKey('5')).toThrow('Unknown key: 5');
      expect(() => resolveKey('5')).toThrow('Unknown key: 5');
    });
  });
});