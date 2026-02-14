import { DiscordPlatform } from '@flarie/discord';
import { FluxerPlatform } from '@flarie/fluxer';
import { Sonarr } from './services/sonarr';
import { Radarr } from './services/radarr';

export type Config = {
  environment: string;
  db: string;
  fluxer: Partial<FluxerPlatform.Options>;
  discord: Partial<DiscordPlatform.Options>;
  sonarr: Partial<Sonarr.Options>;
  radarr: Partial<Radarr.Options>;
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
}

export const config: Config = {
  environment: process.env.NODE_ENV ?? 'development',
  db: process.env.DB_URL ?? 'file:local.db',
  fluxer: {
    token: process.env.FLUXER_BOT_TOKEN,
    status: 'Playing with your heart~ ❤️',
  },
  discord: {
    token: process.env.DISCORD_BOT_TOKEN,
    status: 'Playing with your heart~ ❤️',
  },
  sonarr: {
    url: process.env.SONARR_URL,
    token: process.env.SONARR_API_KEY,
  },
  radarr: {
    url: process.env.RADARR_URL,
    token: process.env.RADARR_API_KEY,
  },
};
