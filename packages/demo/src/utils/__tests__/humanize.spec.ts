import { describe, it, expect } from 'bun:test';
import { humanizeDuration } from '../humanize';

describe('Humanize Utils', () => {
  describe('fn(humanizeDuration)', () => {
    it('should support seconds', () => {
      expect(humanizeDuration(32)).toEqual('32s');
    });

    it('should support minutes', () => {
      expect(humanizeDuration(60)).toEqual('1m');
    });

    it('should support hours', () => {
      expect(humanizeDuration(60 * 60)).toEqual('1h');
    });

    it('should support complexity', () => {
      expect(humanizeDuration(3675)).toEqual('1h 1m 15s');
      expect(humanizeDuration(3875)).toEqual('1h 4m 35s');
      expect(humanizeDuration(3975)).toEqual('1h 6m 15s');
    });
  });
});
