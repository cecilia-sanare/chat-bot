import { Flarie, FlarieEmbed } from '@flarie/core';
import { Radarr } from '../../services/radarr';
import { Sonarr } from '../../services/sonarr';
import { config } from '../../config';
import { humanizeDuration } from '../../utils/humanize';

export function addLookupCommand(flarie: Flarie, sonarr: Sonarr, radarr: Radarr) {
  flarie.register('lookup movie {...name}', async ({ message, args }) => {
    const { name } = args;

    if (!name) return;

    await message.typing();

    const embed = await getMovieEmbed(radarr, name);

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

    const embed = await getShowEmbed(sonarr, name);

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

    const rawEmbeds = await Promise.all([getMovieEmbed(radarr, name), getShowEmbed(sonarr, name)]);
    const embeds = rawEmbeds.filter(Boolean) as FlarieEmbed[];

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

export async function getMovieEmbed(radarr: Radarr, name: string): Promise<FlarieEmbed | undefined> {
  const movies = await radarr.lookup(name);
  const [movie] = movies;

  if (!movie) return undefined;

  const queue = movie.id
    ? await radarr.getEntireQueue({
        movieIds: [movie.id],
      })
    : [];

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
          value: humanizeDuration((movie.runtime ?? 0) * 60) ?? '_Unknown_',
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
      fields: [
        {
          name: 'Time Remaining',
          value: humanizeDuration(computeTimeRemaining(queue)) ?? '_Not Started_',
          inline: true,
        },
      ],
    };
  }

  return {
    ...shared,
    color: '#bb2124',
    description: `Hasn't been released yet!`,
  };
}

export async function getShowEmbed(sonarr: Sonarr, name: string): Promise<FlarieEmbed | undefined> {
  let show = await sonarr.lookup(name);

  if (!show) return undefined;

  const queue = show.id
    ? await sonarr.getEntireQueue({
        seriesIds: [show.id],
      })
    : [];

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
          value: humanizeDuration((show.runtime ?? 0) * 60) ?? '_Unknown_',
          inline: true,
        },
        {
          name: 'Total Runtime',
          value: getTotalRuntime(show) ?? '_Unknown_',
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
      fields: [
        {
          name: 'Time Remaining',
          value: humanizeDuration(computeTimeRemaining(queue)) ?? '_Not Started_',
          inline: true,
        },
      ],
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

  return humanizeDuration(total * 60);
}

export function computeTimeRemaining(queue: Array<Radarr.QueueResource | Sonarr.QueueResource>): number {
  return queue.reduce((output, item) => {
    const timeRemaining = timeLeftToSeconds(item.timeleft);

    return timeRemaining && timeRemaining > output ? timeRemaining : output;
  }, 0);
}

export function timeLeftToSeconds(timeleft?: string): number | undefined {
  if (!timeleft) return undefined;

  const [hours, minutes, seconds] = timeleft.split(':');

  return Number(hours) * 60 * 60 + Number(minutes) * 60 + Number(seconds);
}
