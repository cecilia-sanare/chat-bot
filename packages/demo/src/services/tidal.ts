import { rfetch } from '@ribbon-studios/js-utils';
import { spawn } from 'child_process';
import { createReadStream, existsSync } from 'fs';
import { ReadStream } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { join } from 'path';

const SONGS_DIR = join(process.cwd(), '../../', 'songs');

export class Tidal {
  #clientId: string;
  #clientSecret: string;
  #token?: Tidal.Api.TokenResponse;

  constructor({ clientId, clientSecret }: Tidal.Options) {
    this.#clientId = clientId;
    this.#clientSecret = clientSecret;
  }

  get credentials() {
    return Buffer.from(`${this.#clientId}:${this.#clientSecret}`).toString('base64');
  }

  async token(): Promise<string> {
    const body = new FormData();
    body.set('grant_type', 'client_credentials');

    if (!this.#token) {
      this.#token = await rfetch.post<Tidal.Api.TokenResponse>('https://auth.tidal.com/v1/oauth2/token', {
        headers: {
          Authorization: `Basic ${this.credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });
    }

    return this.#token.access_token;
  }

  async getArtworks(ids?: string[]): Promise<Tidal.Artwork[]> {
    if (!ids || ids.length === 0) return [];

    const token = await this.token();

    const { data: artworks } = await rfetch<Tidal.Api.Response<Tidal.Api.Artwork[]>>(
      'https://openapi.tidal.com/v2/artworks',
      {
        params: {
          countryCode: 'US',
          'filter[id]': ids,
        },
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.api+json',
        },
      }
    );

    return artworks
      .map((artwork) =>
        artwork.attributes.files.map<Tidal.Artwork>((file) => ({
          url: file.href,
          width: file.meta.width,
          height: file.meta.height,
        }))
      )
      .flat();
  }

  async getTrack(url: string): Promise<Tidal.Track | null> {
    const trackId = this.id(url);

    if (!trackId) throw new Error(`Invalid url: ${url}`);

    const token = await this.token();

    const { data: track, included } = await rfetch<Tidal.Api.Response<Tidal.Api.Track>>(
      `https://openapi.tidal.com/v2/tracks/${trackId}`,
      {
        params: {
          countryCode: 'US',
          include: ['albums', 'artists', 'albums.coverArt'],
        },
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.api+json',
        },
      }
    );

    const artists = included.filter(({ type }) => type === 'artists') as Tidal.Api.Artist[];
    const album = included.find(({ type }) => type === 'albums') as Tidal.Api.Album | undefined;
    const artworks = await this.getArtworks(album?.relationships.coverArt.data.map(({ id }) => id));

    return {
      id: track.id,
      title: track.attributes?.title,
      artists: artists.map((artist) => ({
        id: artist.id,
        name: artist.attributes.name,
      })),
      album: album?.attributes.title ?? 'Unknown',
      artwork: artworks.find((artwork) => artwork.width === 320)?.url,
    };
  }

  id(url: string): string | null {
    if (/^\d+$/.test(url)) return url;

    const [, trackId] = url.match(/tidal\.com\/(?:browse\/)?track\/(\d+)/) ?? [];

    return trackId ?? null;
  }

  file(id: string, extension: 'flac' | 'ogg'): string {
    return join(SONGS_DIR, `${id}.${extension}`);
  }

  async download(url: string): Promise<string> {
    const id = this.id(url);

    if (!id) throw new Error(`Invalid URL / ID: ${url}`);

    const outputs = {
      flac: this.file(id, 'flac'),
      ogg: this.file(id, 'ogg'),
    };

    // If we have it cached already bail early
    if (existsSync(outputs.ogg)) return outputs.ogg;

    if (!existsSync(outputs.flac)) {
      await new Promise<void>((resolve, reject) => {
        const dl = spawn(
          'tiddl',
          ['download', ['-p', SONGS_DIR], ['-o', '{item.id}'], ['url', `https://tidal.com/track/${id}/u`]].flat(),
          {
            env: {
              ...process.env,
              TIDDL_AUTH: `${this.#clientId};${this.#clientSecret}`,
            },
          }
        );
        dl.on('close', (code) => (code === 0 ? resolve() : reject()));
      });
    }

    await new Promise<void>((resolve, reject) => {
      const transcode = spawn(
        'ffmpeg',
        [
          ['-i', outputs.flac],
          ['-c:a', 'libopus'],
          ['-b:a', '128k'],
          ['-ar', '48000'],
          ['-filter:a', 'volume=0.02'],
          outputs.ogg,
        ].flat()
      );
      transcode.on('close', (code) => (code === 0 ? resolve() : reject()));
    });

    await unlink(outputs.flac);

    return outputs.ogg;
  }

  async stream(id: string): Promise<ReadStream> {
    const file = await this.download(id);

    return createReadStream(file);
  }
}

export namespace Tidal {
  export type Options = {
    clientId: string;
    clientSecret: string;
  };

  export type Track = {
    id: string;
    title: string;
    artists: Artist[];
    album: string;
    artwork?: string;
  };

  export type Artist = {
    id: string;
    name: string;
  };

  export type Artwork = {
    url: string;
    width: number;
    height: number;
  };

  export namespace Api {
    export type TokenResponse = {
      access_token: string;
    };

    export type Response<T> = {
      data: T;
      included: (Album | Artist | Track | Artwork)[];
    };

    export type Track = {
      id: string;
      type: 'tracks';
      attributes: {
        title: string;
      };
    };

    export type Album = {
      id: string;
      type: 'albums';
      attributes: {
        title: string;
      };

      relationships: {
        coverArt: {
          data: Artwork[];
          links: {
            self: '/albums/504656696/relationships/coverArt?countryCode=US';
          };
        };
      };
    };

    export type Artwork = {
      id: string;
      type: 'artworks';
      attributes: {
        files: File[];
      };
    };

    export type File = {
      href: string;
      meta: {
        width: number;
        height: number;
      };
    };

    export type Artist = {
      id: string;
      type: 'artists';
      attributes: {
        name: string;
      };
    };
  }
}
