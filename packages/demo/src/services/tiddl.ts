import chalk from 'chalk';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { number } from '../utils/parsers';
import { humanizeDuration } from '../utils/humanize';
import { RibbonLogger } from '@ribbon-studios/logger';

const logger = new RibbonLogger('tiddl');

const SONGS_DIR = join(import.meta.dir, 'songs');

export class Tiddl {
  /**
   * The expiration buffer time in seconds
   */
  static BUFFER = 3600;
  #expiration?: NodeJS.Timeout;

  constructor() {
    this.refresh().catch(async (error) => {
      if (error instanceof Tiddl.LoginRequired) {
        await this.login();
        await this.refresh();
      }
    });
  }

  /**
   * Expiration time in ms
   */
  set expiration(expiration: number) {
    if (this.#expiration) clearTimeout(this.#expiration);
    const delay = expiration - Date.now() - Tiddl.BUFFER * 1000;
    logger.info(`Forcibly refreshing token in... ${humanizeDuration(Math.floor(delay / 1000))}`);

    this.#expiration = setTimeout(() => this.refresh(true), Math.max(delay, 0));
  }

  #spawn(args: string[]) {
    return spawn('tiddl', args, { stdio: 'pipe' });
  }

  async #exec(args: string[]): Promise<string> {
    return await new Promise<string>((resolve, reject) => {
      const dl = this.#spawn(args);

      // Hate this, but tiddl doesn't return the correct status codes
      let output = '';

      dl.stdout?.on('data', (data) => (output += data.toString()));
      dl.stderr?.on('data', (data) => (output += data.toString()));

      dl.stderr?.on('data', (data) => logger.error(data.toString()));
      dl.stdout?.on('data', (data) => logger.info(data.toString()));

      dl.on('close', (code) => (code === 0 ? resolve(output) : reject()));
      dl.on('error', reject);
    });
  }

  async login(): Promise<void> {
    return await new Promise<void>((resolve, reject) => {
      const dl = this.#spawn(['auth', 'login']);

      dl.stderr?.on('data', (data) => logger.error(data.toString()));
      dl.stdout?.on('data', (data) => logger.info(data.toString()));

      dl.on('close', (code) => (code === 0 ? resolve() : reject()));
      dl.on('error', reject);
    });
  }

  async refresh(force?: boolean): Promise<void> {
    if (force) {
      await this.#exec(['auth', 'refresh', '-f']);
    }

    const output = await this.#exec(['auth', 'refresh']);

    if (output.includes('Not logged in')) {
      throw new Tiddl.LoginRequired();
    }

    const result = output.match(/expires in (\d+)d (\d+)h (\d+)m/);

    if (!result) {
      return logger.warn('Unable to parse expiration time!');
    }

    const [, days, hours, minutes] = result;

    this.expiration = Date.now() + number(days, 0) * 86400000 + number(hours, 0) * 3600000 + number(minutes, 0) * 60000;
  }

  async download(id: string): Promise<string> {
    const file = join(SONGS_DIR, `${id}.flac`);

    if (existsSync(file)) return file;

    await this.refresh();

    logger.info('Downloading...');

    await this.#exec(
      ['download', ['-p', SONGS_DIR], ['-o', '{item.id}'], ['url', `https://tidal.com/track/${id}/u`]].flat()
    );

    logger.info('Downloading success!');

    return join(SONGS_DIR, `${id}.flac`);
  }
}

export namespace Tiddl {
  export class LoginRequired extends Error {}
}
