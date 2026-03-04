import { join } from 'path';
import { rfetch } from '@ribbon-studios/js-utils';

export class Sonarr {
  #url: string;
  #token: string;

  constructor({ url, token }: Sonarr.Options) {
    this.#url = join(url, '/api');
    this.#token = token;
  }

  async getWanted(page: number = 1, pageSize: number = 100) {
    const result = await rfetch<Sonarr.Paginated<Sonarr.EpisodeResource>>(join(this.#url, '/v3/wanted/missing'), {
      params: {
        page,
        pageSize,
        includeSeries: true,
      },
      headers: {
        'X-Api-Key': this.#token,
      },
    });

    return {
      ...result,
      records: result.records ?? [],
    };
  }

  async getEntireWanted(): Promise<Sonarr.EpisodeResource[]> {
    const { page, totalRecords, records, pageSize } = await this.getWanted();

    const remainingRecords = totalRecords - records.length;

    const pages = Math.ceil(remainingRecords / pageSize);

    const results = await Promise.all(
      Array(pages)
        .fill(null)
        .map((_, i) => this.getWanted(i + page + 1, pageSize))
    );

    return [
      ...records,
      ...results.reduce<Sonarr.EpisodeResource[]>((output, { records }) => output.concat(records), []),
    ];
  }

  async getQueue(page: number = 1, pageSize: number = 100) {
    const result = await rfetch<Sonarr.Paginated<Sonarr.QueueResource>>(join(this.#url, '/v3/queue'), {
      params: {
        page,
        pageSize,
        includeSeries: true,
        includeEpisode: true,
      },
      headers: {
        'X-Api-Key': this.#token,
      },
    });

    return {
      ...result,
      records: result.records ?? [],
    };
  }

  async getEntireQueue(): Promise<Sonarr.QueueResource[]> {
    const { page, totalRecords, records, pageSize } = await this.getQueue();

    const remainingRecords = totalRecords - records.length;

    const pages = Math.ceil(remainingRecords / pageSize);

    const results = await Promise.all(
      Array(pages)
        .fill(null)
        .map((_, i) => this.getQueue(i + page + 1, pageSize))
    );

    return [...records, ...results.reduce<Sonarr.QueueResource[]>((output, { records }) => output.concat(records), [])];
  }

  async lookup(term: string) {
    const [show] = await rfetch<Sonarr.SeriesResource[]>(join(this.#url, '/v3/series/lookup'), {
      params: {
        term,
      },
      headers: {
        'X-Api-Key': this.#token,
      },
    });

    if (!show) return undefined;
    if (!show.id) return show;

    return this.getShowById(show.id);
  }

  async getShowById(id: number) {
    return await rfetch<Sonarr.SeriesResource>(join(this.#url, `/v3/series/${id}`), {
      headers: {
        'X-Api-Key': this.#token,
      },
    });
  }
}

export namespace Sonarr {
  export type Options = {
    url: string;
    token: string;
  };

  export type Paginated<T> = {
    page: number;
    pageSize: number;
    sortKey: string | null;
    sortDirection: 'default' | 'ascending' | 'descending';
    totalRecords: number;
    records: T[] | null;
  };

  export type SeriesResource = {
    id?: number;
    title: string | null;
    status: SeriesStatus;
    remotePoster: string | null;
    tvdbId: string;
    monitored: boolean;
    images: {
      coverType: 'banner' | 'poster' | 'fanart' | 'clearlogo';
      url: string;
      remoteUrl: string;
    }[];
    statistics: {
      episodeFileCount: number;
      episodeCount: number;
    };
  };

  export type EpisodeResource = {
    id: number;
    seriesId: number;
    tvdbId: number;
    episodeFileId: number;
    seasonNumber: number;
    episodeNumber: number;
    title: string | null;
    airDate: string | null;
    airDateUtc: string | null;
    lastSearchTime: string | null;
    series: {
      id: number;
      title: string | null;
      titleSlug: string;
      status: SeriesStatus;
    };
  };

  export type QueueResource = {
    id: number | null;
    seriesId: number | null;
    episodeId: number | null;
    series?: {
      title?: string;
      titleSlug?: string;
    };
    episode?: {
      title: string;
      titleSlug?: string;
      seasonNumber: number;
      episodeNumber: number;
    };
  };

  export enum SeriesStatus {
    CONTINUING = 'continuing',
    ENDED = 'ended',
    UPCOMING = 'upcoming',
    DELETED = 'deleted',
  }
}
