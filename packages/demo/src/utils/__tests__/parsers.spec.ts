import { describe, expect, it } from 'bun:test';
import { number } from '../parsers';

describe('Parsers', () => {
  describe('fn(number)', () => {
    it('should support numbers', () => {
      expect(number(1)).toBe(1);
    });

    it('should support strings', () => {
      expect(number('1')).toBe(1);
    });

    it('should support invalid numbers', () => {
      expect(number('1abc')).toBe(null);
    });

    it.each([undefined, null])('should support %p', (value) => {
      expect(number(value)).toBe(null);
    });
  });
});
