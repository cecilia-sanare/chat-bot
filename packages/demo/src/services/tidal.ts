import { delay, retry, rfetch, RibbonFetchBasicOptions } from '@ribbon-studios/js-utils';
import { createReadStream, existsSync } from 'fs';
import { ReadStream } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { join } from 'path';
import { Tiddl } from './tiddl';
import { transcode } from '../utils/tools';
import { number } from '../utils/parsers';
import { RibbonLogger } from '@ribbon-studios/logger';
import { SONGS, TIDDL_CONFIGS } from '../constants/directories';

const logger = new RibbonLogger('tidal');

export class Tidal {
  #clientId: string;
  #clientSecret: string;
  #token?: Tidal.Api.TokenResponse;
  #refresh?: NodeJS.Timeout;
  #clients: Record<string, Tiddl> = {};

  /**
   * The expiration buffer time in seconds
   */
  static BUFFER = 60;

  constructor({ clientId, clientSecret }: Tidal.Options) {
    this.#clientId = clientId;
    this.#clientSecret = clientSecret;
  }

  get credentials() {
    return Buffer.from(`${this.#clientId}:${this.#clientSecret}`).toString('base64');
  }

  getClient(guildId: string): Tiddl {
    let client = this.#clients[guildId];

    if (!client) {
      client = new Tiddl({
        config: join(TIDDL_CONFIGS, `${guildId}.json`),
      });

      this.#clients[guildId] = client;
    }

    return client;
  }

  async token(force?: boolean): Promise<string> {
    const body = new FormData();
    body.set('grant_type', 'client_credentials');

    if (!this.#token || force) {
      if (this.#refresh) clearInterval(this.#refresh);

      this.#token = await rfetch.post<Tidal.Api.TokenResponse>('https://auth.tidal.com/v1/oauth2/token', {
        headers: {
          Authorization: `Basic ${this.credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });

      this.#refresh = setTimeout(() => this.token(true), (this.#token.expires_in - Tidal.BUFFER) * 1000);
    }

    return this.#token.access_token;
  }

  async #fetch<T>(endpoint: string, options: RibbonFetchBasicOptions): Promise<T> {
    const token = await this.token();

    const url = join('https://openapi.tidal.com', endpoint);

    return await retry(async () => {
      try {
        return await rfetch.get<T>(url, {
          ...options,
          params: {
            ...options.params,
            countryCode: 'US',
          },
          headers: {
            ...options.headers,
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.api+json',
          },
        });
      } catch (error) {
        if (rfetch.is.error(error)) {
          const retryAfter = number(error.headers.get('retry-after'));

          if (retryAfter) {
            logger.warn(`Rate limited while hitting "${url}"! Pausing for ${retryAfter} seconds...`);

            await delay(retryAfter * 1000);

            logger.warn(`Rate limiting elapsed! Retrying...`);
          }
        }

        throw error;
      }
    }, 10);
  }

  async getArtworks(ids?: string[]): Promise<Tidal.Artwork[]> {
    if (!ids || ids.length === 0) return [];

    const { data: artworks } = await this.#fetch<Tidal.Api.Response<Tidal.Api.Artwork[]>>('/v2/artworks', {
      params: {
        'filter[id]': ids,
      },
    });

    return artworks.map<Tidal.Artwork>((artwork) => ({
      id: artwork.id,
      type: 'artwork',
      files: artwork.attributes.files.map((file) => ({
        url: file.href,
        width: file.meta.width,
        height: file.meta.height,
      })),
    }));
  }

  parse(url: string): Tidal.ParsedUrl | null {
    if (/^\d+$/.test(url)) {
      return {
        id: url,
        type: 'track',
      };
    }

    const [, trackId] = url.match(/tidal\.com\/(?:browse\/)?track\/(\d+)/) ?? [];

    if (trackId) {
      return {
        id: trackId,
        type: 'track',
      };
    }

    const [, playlistId] = url.match(/tidal.com\/playlist\/([\w\d\-]+)/) ?? [];

    if (playlistId) {
      return {
        id: playlistId,
        type: 'playlist',
        tracks: [],
      };
    }

    return null;
  }

  async getPlaylist(url: Tidal.ParsedUrl): Promise<Tidal.Playlist | null> {
    if (url.type !== 'playlist') throw new Error(`Invalid type. (${url.type})`);

    const { data: playlist } = await this.#fetch<Tidal.Api.Response<Tidal.Api.Playlist>>(`/v2/playlists/${url.id}`, {
      params: {
        include: ['coverArt'],
      },
    });

    let cursor: string | null | undefined = undefined;
    const result: Tidal.Api.Track[] = [];
    while (cursor !== null) {
      const page = await this.getPlaylistRelationships(url, cursor);
      result.push(...page.data.filter((item) => item.type === 'tracks'));
      cursor = page.nextCursor ?? null;
    }

    const [tracks, artworks] = await Promise.all([
      this.getTracks(
        result.map(({ id }) => ({
          id,
          type: 'track',
        }))
      ),
      this.getArtworks(playlist.relationships.coverArt.data.map(({ id }) => id)),
    ]);

    const trackById = tracks.reduce<Record<string, Tidal.Track>>(
      (output, track) => ({
        ...output,
        [track.id]: track,
      }),
      {}
    );

    const [artwork] = artworks;

    return {
      id: playlist.id,
      type: 'playlist',
      title: playlist.attributes.name,
      tracks: result.map(({ id }) => trackById[id]!),
      artwork: artwork?.files.find((artwork) => artwork.width === 320)?.url,
    };
  }

  async getPlaylistRelationships(url: Tidal.ParsedUrl, cursor?: string): Promise<Tidal.Page<Tidal.Api.Included>> {
    if (url.type !== 'playlist') throw new Error('');

    const { data, links } = await this.#fetch<Tidal.Api.PaginatedResponse<Tidal.Api.Included[]>>(
      `/v2/playlists/${url.id}/relationships/items`,
      {
        params: {
          'page[cursor]': cursor,
        },
      }
    );

    return {
      data,
      nextCursor: links.meta?.nextCursor,
    };
  }

  async getTracks(urls: Tidal.ParsedUrl[]): Promise<Tidal.Track[]> {
    try {
      const tracks: Tidal.Api.Track[] = [];
      const included: Record<string, Tidal.Api.Included> = {};

      for (let i = 0; i < urls.length; i += 20) {
        const ids = urls.slice(i, i + 20).map(({ id }) => id);

        const { data: slicedTracks, included: slicedIncluded } = await this.#fetch<
          Tidal.Api.Response<Tidal.Api.Track[]>
        >(`/v2/tracks`, {
          params: {
            include: ['albums', 'artists', 'albums.coverArt'],
            'filter[id]': ids,
          },
        });

        tracks.push(...slicedTracks);

        slicedIncluded.forEach((item) => {
          included[`${item.type}-${item.id}`] = item;
        });
      }

      const cache: Record<string, Tidal.Artwork> = {};

      const result: Tidal.Track[] = [];

      for (const track of tracks) {
        const artists = track.relationships.artists.data.map(
          (artist) => included[`${artist.type}-${artist.id}`]!
        ) as Tidal.Api.Artist[];
        const albums = track.relationships.albums.data.map(
          (item) => included[`${item.type}-${item.id}`]
        ) as Tidal.Api.Album[];

        const [album] = albums;

        const { cached, uncached } = album?.relationships.coverArt.data.reduce<{
          cached: Tidal.Artwork[];
          uncached: string[];
        }>(
          (output, { id }) => {
            if (cache[id]) {
              output.cached.push(cache[id]);
            } else {
              output.uncached.push(id);
            }

            return output;
          },
          {
            cached: [],
            uncached: [],
          }
        ) ?? {
          cached: [],
          uncached: [],
        };

        const uncachedArtworks = await this.getArtworks(uncached);

        for (const artwork of uncachedArtworks) {
          cache[artwork.id] = artwork;
        }

        const artworks = [...cached, ...uncachedArtworks];

        const [artwork] = artworks;

        result.push({
          id: track.id,
          type: 'track',
          url: track.attributes.externalLinks.find(({ meta }) => meta.type === 'TIDAL_SHARING')?.href,
          title: track.attributes.title,
          artists: artists.map((artist) => ({
            id: artist.id,
            type: 'artist',
            name: artist.attributes.name,
          })),
          album: album?.attributes.title ?? 'Unknown',
          artwork: artwork?.files.find((artwork) => artwork.width === 320)?.url,
        });
      }

      return result;
    } catch (error) {
      if (rfetch.is.error(error)) {
        console.error(error.content);
      }

      throw error;
    }
  }

  async getTrack(url: Tidal.ParsedUrl): Promise<Tidal.Track | null> {
    if (url.type !== 'track') throw new Error(`Invalid type. (${url.type})`);

    const [track] = await this.getTracks([url]);

    return track ?? null;
  }

  file(id: string, extension: 'flac' | 'ogg'): string {
    return join(SONGS, `${id}.${extension}`);
  }

  async download(guildId: string, id: string): Promise<string> {
    const ogg = this.file(id, 'ogg');

    // If we have it cached already bail early
    if (existsSync(ogg)) return ogg;

    const flac = await this.getClient(guildId).download(id);

    await transcode(flac, ogg);
    await unlink(flac);

    return ogg;
  }

  async stream(guildId: string, id: string): Promise<ReadStream> {
    const file = await this.download(guildId, id);

    return createReadStream(file);
  }
}

export namespace Tidal {
  export type Options = {
    clientId: string;
    clientSecret: string;
  };

  export type ParsedUrl = ParsedUrl.Playlist | ParsedUrl.Track;

  export namespace ParsedUrl {
    export type Playlist = {
      id: string;
      type: 'playlist';
      tracks: string[];
    };

    export type Track = {
      id: string;
      type: 'track';
    };
  }

  export type Playlist = {
    id: string;
    type: 'playlist';
    title: string;
    tracks: Track[];
    artwork?: string;
  };

  export type Track = {
    id: string;
    type: 'track';
    title: string;
    artists: Artist[];
    album: string;
    artwork?: string;
    url?: string;
  };

  export type Included = Album | Artist | Track | Artwork;

  export type Album = {
    id: string;
    type: 'album';
    title: string;
  };

  export type Artist = {
    id: string;
    type: 'artist';
    name: string;
  };

  export type Artwork = {
    id: string;
    type: 'artwork';
    files: ArtworkFile[];
  };

  export type ArtworkFile = {
    url: string;
    width: number;
    height: number;
  };

  export type Page<T> = {
    data: T[];
    nextCursor?: string;
  };

  export namespace Api {
    export type TokenResponse = {
      access_token: string;

      /**
       * The expiration time in seconds
       */
      expires_in: number;

      scope: string;
      token_type: 'Bearer';
    };

    export type Response<T> = {
      data: T;
      included: Included[];
    };

    export type Included = Album | Artist | Track | Artwork;

    export type PaginatedResponse<T> = Response<T> & {
      links: {
        meta?: {
          nextCursor: string;
        };
      };
    };

    export type Playlist = {
      id: string;
      type: 'playlists';
      attributes: {
        name: string;
        numberOfItems: number;
      };

      relationships: {
        coverArt: {
          data: Artwork[];
          links: {
            self: '/albums/504656696/relationships/coverArt?countryCode=US';
          };
        };
        items: {
          data: Pick<Track, 'id' | 'type'>[];
        };
      };
    };

    export type Track = {
      id: string;
      type: 'tracks';
      attributes: {
        title: string;
        externalLinks: ExternalLink[];
      };

      relationships: {
        albums: {
          data: Album[];
        };
        artists: {
          data: Artist[];
        };
      };
    };

    export type ExternalLink = {
      href: string;
      meta: {
        type: string;
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
