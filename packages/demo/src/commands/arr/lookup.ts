import { Flarie, FlarieEmbed } from '@flarie/core';
import { Radarr } from '../../services/radarr';
import { Sonarr } from '../../services/sonarr';
import { config } from '../../config';

export function addLookupCommand(flarie: Flarie, sonarr: Sonarr, radarr: Radarr) {
  flarie.register('lookup movie {...name}', async ({ message, args }) => {
    const { name } = args;

    if (!name) return;

    await message.typing();

    const movies = await radarr.lookup(name);
    const [movie] = movies;

    const embed = getMovieEmbed(movie);

    if (!embed) {
      return await message.reply({
        content: 'Oops! We were unable to locate any movies with that name, sorry!',
      });
    }

    return await message.reply({
      embeds: [embed],
    });
  });

  flarie.register('lookup show {...name}', async ({ message, args }) => {
    const { name } = args;

    if (!name) return;

    await message.typing();

    const show = await sonarr.lookup(name);

    const embed = getShowEmbed(show);

    if (!embed) {
      return await message.reply({
        content: 'Oops! We were unable to locate any shows with that name, sorry!',
      });
    }

    return await message.reply({
      embeds: [embed],
    });
  });

  flarie.register('lookup {...name}', async ({ message, args }) => {
    const { name } = args;

    if (!name) return;

    await message.typing();

    const [movies, show] = await Promise.all([radarr.lookup(name), sonarr.lookup(name)]);
    const [movie] = movies;

    const embeds = [getMovieEmbed(movie), getShowEmbed(show)].filter(Boolean) as FlarieEmbed[];

    if (embeds.length === 0) {
      return await message.reply({
        content: 'Oops! We were unable to locate any movies or shows with that name, sorry!',
      });
    }

    return await message.reply({
      embeds,
    });
  });
}

export function getMovieEmbed(movie?: Radarr.MovieResource | undefined): FlarieEmbed | undefined {
  if (!movie) return undefined;

  const shared: FlarieEmbed = {
    author: '🎬️ Movie',
    title: movie.title ?? undefined,
    url: `https://www.themoviedb.org/movie/${movie.tmdbId}`,
    thumbnail: movie.remotePoster ?? undefined,
  };

  if (movie.movieFile) {
    return {
      ...shared,
      color: '#53a653',
      description: 'Now available on jellyfin!',
      fields: [
        {
          name: 'Runtime',
          value: movie.runtime ? humanizeDuration(movie.runtime) : 'Unknown',
          inline: true,
        },
      ],
    };
  }

  if (movie.status === Radarr.MovieStatus.RELEASED) {
    if (!movie.monitored) {
      return {
        ...shared,
        color: '#bb2124',
        description: `Not currently monitored!`,
        url: movie.title ? `${config.radarr.url}/add/new?term=${encodeURIComponent(movie.title)}` : shared.title,
      };
    }

    return {
      ...shared,
      color: '#f0ad4e',
      description: 'Has been requested!',
    };
  }

  return {
    ...shared,
    color: '#bb2124',
    description: `Hasn't been released yet!`,
  };
}

export function getShowEmbed(show?: Sonarr.SeriesResource | undefined): FlarieEmbed | undefined {
  if (!show) return undefined;

  const image = show.images.find(({ coverType }) => coverType === 'poster');

  const shared: FlarieEmbed = {
    author: '📺 Show',
    title: show.title ?? undefined,
    url: `https://www.thetvdb.com/?tab=series&id=${show.tvdbId}`,
    thumbnail: image?.remoteUrl ?? undefined,
  };

  if (show.statistics.episodeCount > 0 && show.statistics.episodeCount === show.statistics.episodeFileCount) {
    return {
      ...shared,
      color: '#53a653',
      description: 'Available on jellyfin!',
      fields: [
        {
          name: 'Runtime',
          value: show.runtime ? humanizeDuration(show.runtime) : 'Unknown',
          inline: true,
        },
        {
          name: 'Total Runtime',
          value: getTotalRuntime(show) ?? 'Unknown',
          inline: true,
        },
        {
          name: '‎ ',
          value: '‎ ',
          inline: true,
        },
        ...show.seasons
          .filter(({ seasonNumber }) => seasonNumber !== 0)
          .map(({ seasonNumber, statistics }) => ({
            name: `Season ${seasonNumber}`,
            value: `${statistics.episodeCount} Episodes`,
            inline: true,
          })),
      ],
    };
  }

  if (show.status !== Sonarr.SeriesStatus.UPCOMING) {
    if (!show.id) {
      return {
        ...shared,
        color: '#bb2124',
        description: `Not currently monitored!`,
        url: show.title ? `${config.sonarr.url}/add/new?term=${encodeURIComponent(show.title)}` : shared.title,
      };
    }

    return {
      ...shared,
      color: '#f0ad4e',
      description: 'Has been requested!',
    };
  }

  return {
    ...shared,
    color: '#bb2124',
    description: `Hasn't been released yet!`,
  };
}

export function getTotalRuntime(show: Sonarr.SeriesResource): string | undefined {
  if (!show.runtime) return undefined;

  const total = show.seasons.reduce((output, season) => (output += season.statistics.episodeCount * show.runtime!), 0);

  return humanizeDuration(total);
}

export function humanizeDuration(value: number): string {
  const minutes = value % 60;
  const hours = (value - minutes) / 60;

  const output: string[] = [];

  if (hours) {
    output.push(`${hours}h`);
  }

  if (minutes) {
    output.push(`${minutes}m`);
  }

  return output.join(' ');
}
