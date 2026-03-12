import chalk from 'chalk';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

const SONGS_DIR = join(import.meta.dir, 'songs');

export class Tiddl {
  async #exec(args: string[]): Promise<string> {
    return await new Promise<string>((resolve, reject) => {
      const dl = spawn('tiddl', args, { stdio: 'pipe' });

      // Hate this, but tiddl doesn't return the correct status codes
      let output = '';

      dl.stdout?.on('data', (data) => (output += data.toString()));
      dl.stderr?.on('data', (data) => (output += data.toString()));

      dl.stderr?.on('data', (data) => console.error(chalk.red('[tiddl]', data.toString())));
      dl.stdout?.on('data', (data) => console.log('[tiddl]', data.toString()));

      dl.on('close', (code) => (code === 0 ? resolve(output) : reject()));
      dl.on('error', reject);
    });
  }

  async refresh(): Promise<void> {
    const output = await this.#exec(['auth', 'refresh']);

    if (output.includes('Not logged in')) {
      throw new Error('Please login to tiddl!');
    }
  }

  async download(id: string): Promise<string> {
    const file = join(SONGS_DIR, `${id}.flac`);

    if (existsSync(file)) return file;

    await this.refresh();

    console.log('Downloading...');

    await this.#exec(
      ['download', ['-p', SONGS_DIR], ['-o', '{item.id}'], ['url', `https://tidal.com/track/${id}/u`]].flat()
    );

    console.log('Downloading success!');

    return join(SONGS_DIR, `${id}.flac`);
  }
}
