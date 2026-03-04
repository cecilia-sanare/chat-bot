import { describe, it, expect } from 'bun:test';
import { groupBy } from '../array';

describe('Array Utils', () => {
  describe('fn(groupBy)', () => {
    it('should group the items by a key', () => {
      const byStatus = groupBy(
        [
          {
            status: 1,
          },
          {
            status: 2,
          },
        ],
        'status'
      );

      expect(byStatus).toEqual({
        1: [{ status: 1 }],
        2: [{ status: 2 }],
      });
    });
  });
});
