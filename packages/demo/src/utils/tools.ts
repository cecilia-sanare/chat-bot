import { spawn, spawnSync } from 'child_process';

/**
 * Transcodes a audio file from flac -> opus
 * Uses ffmpeg if its available, otherwise falls back to opusenc
 */
export async function transcode(input: string, output: string): Promise<void> {
  try {
    const transcoder = detect.transcoder();

    if (transcoder === 'ffmpeg') {
      console.log('[ffmpeg] Transcoding...');
      await new Promise<void>((resolve, reject) => {
        const transcode = spawn(
          'ffmpeg',
          [
            ['-i', input],
            ['-c:a', 'libopus'],
            ['-b:a', '128k'],
            ['-ar', '48000'],
            ['-filter:a', 'volume=0.02'],
            output,
          ].flat()
        );
        transcode.on('close', (code) => (code === 0 ? resolve() : reject()));
        transcode.on('error', reject);
        transcode.on('exit', (code) => (code === 0 ? resolve() : reject()));
      });
    } else {
      throw new Error('No transcoder found');
    }
  } catch (error) {
    console.error(error);
    throw new Error('Failed to transcode song');
  }

  console.log('Transcoding success!');
}

export namespace detect {
  export function transcoder(): 'ffmpeg' | 'opusenc' | null {
    if (spawnSync('ffmpeg', ['-version']).status === 0) return 'ffmpeg';
    if (spawnSync('opusenc', ['--version']).status === 0) return 'opusenc';
    return null;
  }
}
