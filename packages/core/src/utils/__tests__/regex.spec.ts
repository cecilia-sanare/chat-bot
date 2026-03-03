import { describe, it, expect } from 'bun:test';
import { toRegExpFunction } from '../regex';

describe('Regex Utils', () => {
  describe('fn(toRegExp)', () => {
    it('should simple messages', () => {
      const exec = toRegExpFunction('info');

      const [matches, groups] = exec('info');
      expect(matches).toBeTrue();
      expect(groups).toEqual({});
    });

    it('should support variables', () => {
      const exec = toRegExpFunction('set prefix {prefix}');

      const [matches, groups] = exec('set prefix !');

      expect(matches).toBeTrue();
      expect(groups).toEqual({
        prefix: '!',
      });
    });

    it('should support quotes', () => {
      const exec = toRegExpFunction('set {name}');

      const [matches, groups] = exec('set "Hello World"');

      expect(matches).toBeTrue();
      expect(groups).toEqual({
        name: 'Hello World',
      });
    });

    it('should support "..." variables', () => {
      const exec = toRegExpFunction('set {...name}');

      const [matches, groups] = exec('set Hello World');

      expect(matches).toBeTrue();
      expect(groups).toEqual({
        name: 'Hello World',
      });
    });

    it('should support quotes with "..." variables', () => {
      const exec = toRegExpFunction('set {...name}');

      const [matches, groups] = exec('set "Hello World"');

      expect(matches).toBeTrue();
      expect(groups).toEqual({
        name: 'Hello World',
      });
    });

    it('should support multiple variables', () => {
      const exec = toRegExpFunction('say {hello} {world}');

      const [matches, groups] = exec('say hallo welt');

      expect(matches).toBeTrue();
      expect(groups).toEqual({
        hello: 'hallo',
        world: 'welt',
      });
    });
  });
});
