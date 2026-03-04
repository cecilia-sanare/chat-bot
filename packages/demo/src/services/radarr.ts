import { join } from 'path';
import { rfetch } from '@ribbon-studios/js-utils';

export class Radarr {
  #url: string;
  #token: string;

  constructor({ url, token }: Radarr.Options) {
    this.#url = join(url, '/api');
    this.#token = token;
  }

  async getWanted(page: number = 1, pageSize: number = 100) {
    const result = await rfetch<Radarr.Paginated<Radarr.MovieResource>>(join(this.#url, '/v3/wanted/missing'), {
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

  async getEntireWanted(): Promise<Radarr.MovieResource[]> {
    const { page, totalRecords, records, pageSize } = await this.getWanted();

    const remainingRecords = totalRecords - records.length;

    const pages = Math.ceil(remainingRecords / pageSize);

    const results = await Promise.all(
      Array(pages)
        .fill(null)
        .map((_, i) => this.getWanted(i + page + 1, pageSize))
    );

    return [...records, ...results.reduce<Radarr.MovieResource[]>((output, { records }) => output.concat(records), [])];
  }

  async getQueue(page: number = 1, pageSize: number = 100) {
    const result = await rfetch<Radarr.Paginated<Radarr.QueueResource>>(join(this.#url, '/v3/queue'), {
      params: {
        page,
        pageSize,
        includeMovie: true,
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

  async getEntireQueue(): Promise<Radarr.QueueResource[]> {
    const { page, totalRecords, records, pageSize } = await this.getQueue();

    const remainingRecords = totalRecords - records.length;

    const pages = Math.ceil(remainingRecords / pageSize);

    const results = await Promise.all(
      Array(pages)
        .fill(null)
        .map((_, i) => this.getQueue(i + page + 1, pageSize))
    );

    return [...records, ...results.reduce<Radarr.QueueResource[]>((output, { records }) => output.concat(records), [])];
  }

  async lookup(term: string) {
    return await rfetch<Radarr.MovieResource[]>(join(this.#url, '/v3/movie/lookup'), {
      params: {
        term,
      },
      headers: {
        'X-Api-Key': this.#token,
      },
    });
  }
}

export namespace Radarr {
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

  export type MovieResource = {
    id: number;
    imdbId: number;
    tmdbId: number;
    title: string | null;
    titleSlug: string | null;
    remotePoster: string | null;
    status: MovieStatus;
    monitored: boolean;
    isAvailable: boolean;
    movieFile?: MovieFile;
    runtime?: number;
  };

  export type MovieFile = {
    movieId: number;
    quality: {
      quality: {
        id: number;
        name: string;
      };
    };
  };

  export enum MovieStatus {
    TO_BE_ANNOUNCED = 'tba',
    ANNOUNCED = 'announced',
    IN_CINEMAS = 'inCinemas',
    RELEASED = 'released',
    DELETED = 'deleted',
  }

  export type QueueResource = {
    id: number | null;
    movieId: number | null;
    movie?: {
      title?: string;
      titleSlug?: string;
    };
  };
}
