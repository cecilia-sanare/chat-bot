import { DiscordPlatform } from '@flarie/discord';
import { FluxerPlatform } from '@flarie/fluxer';
import { Sonarr } from './services/sonarr';
import { Radarr } from './services/radarr';
import { Tidal } from './services/tidal';
import { join, resolve } from 'path';

export type Config = {
  version: string;
  short_version: string;
  environment: string;
  data_directory: string;
  db: string;
  fluxer: Partial<FluxerPlatform.Options>;
  discord: Partial<DiscordPlatform.Options>;
  sonarr: Partial<Sonarr.Options>;
  radarr: Partial<Radarr.Options>;
  tidal: Partial<Tidal.Options>;
};

export namespace defined {
  export function fluxer(value: Partial<FluxerPlatform.Options>): value is FluxerPlatform.Options {
    return 'token' in value;
  }

  export function discord(value: Partial<DiscordPlatform.Options>): value is DiscordPlatform.Options {
    return 'token' in value;
  }

  export function sonarr(value: Partial<Sonarr.Options>): value is Sonarr.Options {
    return 'url' in value && 'token' in value;
  }

  export function radarr(value: Partial<Radarr.Options>): value is Radarr.Options {
    return 'url' in value && 'token' in value;
  }

  export function tidal(value: Partial<Tidal.Options>): value is Tidal.Options {
    return 'clientId' in value && 'clientSecret' in value;
  }
}

const version = process.env.VERSION ?? 'local';
const data_directory = process.env.DATA_DIR ?? resolve('.');

export const config: Config = {
  version,
  short_version: version.substring(0, 7),
  environment: process.env.NODE_ENV ?? 'development',
  data_directory,
  db: process.env.DB_URL ?? `file:${join(data_directory, 'local.db')}`,
  fluxer: {
    token: process.env.FLUXER_BOT_TOKEN,
    status: process.env.STATUS ?? 'Playing with your heart~ ❤️',
  },
  discord: {
    token: process.env.DISCORD_BOT_TOKEN,
    status: process.env.STATUS ?? 'Playing with your heart~ ❤️',
  },
  sonarr: {
    url: process.env.SONARR_URL,
    token: process.env.SONARR_API_KEY,
  },
  radarr: {
    url: process.env.RADARR_URL,
    token: process.env.RADARR_API_KEY,
  },
  tidal: {
    clientId: process.env.TIDAL_CLIENT_ID,
    clientSecret: process.env.TIDAL_CLIENT_SECRET,
  },
};
