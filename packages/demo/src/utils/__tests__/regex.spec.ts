import { describe, it, expect } from 'bun:test';
import { toRegExp } from '../regex';

describe('Regex Utils', () => {
  describe('fn(toRegExp)', () => {
    it('should simple messages', () => {
      const expression = toRegExp('info');

      expect(expression).toEqual(new RegExp('^info$'));

      const result = expression.exec('info');
      expect(Array.from(result?.values() ?? [])).toEqual(['info']);
      expect(result?.groups).toEqual(undefined);
    });

    it('should support variables', () => {
      const expression = toRegExp('set prefix {prefix}');

      expect(expression).toEqual(new RegExp('^set prefix (?<prefix>[^\s]+)$'));

      const result = expression.exec('set prefix !');
      expect(Array.from(result?.values() ?? [])).toEqual(['set prefix !', '!']);
      expect(result?.groups).toEqual({
        prefix: '!',
      });
    });

    it('should support multiple variables', () => {
      const expression = toRegExp('say {hello} {world}');

      expect(expression).toEqual(new RegExp('^say (?<hello>[^\s]+) (?<world>[^\s]+)$'));

      const result = expression.exec('say hallo welt');
      expect(Array.from(result?.values() ?? [])).toEqual(['say hallo welt', 'hallo', 'welt']);
      expect(result?.groups).toEqual({
        hello: 'hallo',
        world: 'welt',
      });
    });
  });
});
