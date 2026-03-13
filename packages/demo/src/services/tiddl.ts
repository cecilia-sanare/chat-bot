import { spawn } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { number } from '../utils/parsers';
import { humanizeDuration } from '../utils/humanize';
import { RibbonLogger } from '@ribbon-studios/logger';
import { SONGS } from '../constants/directories';

const logger = new RibbonLogger('tiddl');

export class Tiddl {
  #listeners: Tiddl.Listeners = {
    'login:required': [],
  };

  #options: Tiddl.Options;

  /**
   * The expiration buffer time in seconds
   */
  static BUFFER = 3600;
  #expiration?: NodeJS.Timeout;

  constructor(options: Tiddl.Options) {
    this.#options = options;

    mkdirSync(this.#options.config, {
      recursive: true,
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
    return spawn('tiddl', args, {
      env: {
        ...process.env,
        TIDDL_PATH: this.#options.config,
      },
      stdio: 'pipe',
    });
  }

  async #exec(args: string[], debug?: boolean): Promise<string> {
    return await new Promise<string>((resolve, reject) => {
      const dl = this.#spawn(args);

      // Hate this, but tiddl doesn't return the correct status codes
      let output = '';

      dl.stdout?.on('data', (data) => (output += data.toString()));
      dl.stderr?.on('data', (data) => (output += data.toString()));

      if (debug) {
        dl.stderr?.on('data', (data) => logger.error(data.toString()));
        dl.stdout?.on('data', (data) => logger.info(data.toString()));
      }

      dl.on('close', (code) => (code === 0 ? resolve(output) : reject()));
      dl.on('error', reject);
    });
  }

  async login(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const dl = this.#spawn(['auth', 'login']);

      dl.stderr?.on('data', (data) => logger.error(data.toString()));
      dl.stdout?.on('data', (data) => logger.info(data.toString()));

      dl.stdout?.on('data', (data) => {
        const line: string = data.toString();
        const [, url] = line.match(/'(https:\/\/link.tidal.com\/[^']+)'/) ?? [];

        if (!url) return;

        this.#emit('login:required', { url });
      });

      dl.on('close', (code) => (code === 0 ? resolve() : reject()));
      dl.on('error', reject);
    });

    // Always refresh after logging in to get the expiration time
    await this.refresh();
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
    const file = join(SONGS, `${id}.flac`);

    if (existsSync(file)) return file;

    await this.refresh();

    logger.info('Downloading...');

    await this.#exec(
      ['download', ['-p', SONGS], ['-o', '{item.id}'], ['url', `https://tidal.com/track/${id}/u`]].flat()
    );

    logger.info('Downloading success!');

    return join(SONGS, `${id}.flac`);
  }

  on<E extends keyof Tiddl.Listeners>(event: E, listener: Tiddl.Listeners[E][number]): void {
    this.#listeners[event].push(listener);
  }

  once<E extends keyof Tiddl.Listeners>(event: E, listener: Tiddl.Listeners[E][number]): void {
    const onceListener: Tiddl.Listeners[E][number] = (...args) => {
      listener.call(undefined, ...args);
      this.off('login:required', onceListener);
    };

    this.on('login:required', onceListener);
  }

  async off<E extends keyof Tiddl.Listeners>(event: E, callback: Tiddl.Listeners[E][number]) {
    const index = this.#listeners[event].indexOf(callback as any);

    if (index === -1) return;

    this.#listeners[event] = this.#listeners[event].splice(index, 1) as any;
  }

  async #emit<E extends keyof Tiddl.Listeners>(
    event: E,
    ...args: Parameters<Tiddl.Listeners[E][number]>
  ): Promise<void> {
    const listeners = this.#listeners[event];

    await Promise.all(listeners.map((listener) => listener.call(undefined, ...args)));
  }
}

export namespace Tiddl {
  export type Options = {
    config: string;
  };

  export class LoginRequired extends Error {}

  export type Listeners = {
    'login:required': LoginRequiredListener[];
  };

  export type LoginRequiredListener = (details: LoginRequiredDetails) => void;
  export type LoginRequiredDetails = { url: string };
}
