import { describe, it, expect, vi } from 'bun:test';
import { exec, toRegExpFunction } from '../regex';

describe('Regex Utils', () => {
  describe('fn(toRegExp)', () => {
    it('should simple messages', () => {
      const exec = toRegExpFunction('info');

      const [matches, groups] = exec('info');
      expect(matches).toBeTrue();
      expect(groups).toEqual({});
    });

    it('should multiple messages', () => {
      const exec = toRegExpFunction(['unpause', 'resume']);

      const [matches, groups] = exec('resume');
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

  describe('fn(exec)', () => {
    it('should return the first match', () => {
      const first = /^hello$/;
      const second = /^hallo$/;
      const secondExec = vi.spyOn(second, 'exec');

      // TODO: Look into the bulk undo that zed does
      const [match, groups] = exec([first, second], 'hello')!;

      expect(match).toEqual('hello');
      expect(groups).toEqual(undefined);
      expect(secondExec).not.toHaveBeenCalled();
    });

    it('should return null if none of the regexes match', () => {
      const result = exec([], 'hello');

      expect(result).toEqual(null);
    });
  });
});
