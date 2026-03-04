import { Flarie, FlarieEmbed, FlarieOutgoingMessage } from '@flarie/core';
import { Radarr } from '../../services/radarr';
import { Sonarr } from '../../services/sonarr';

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
    };
  }

  if (movie.status === Radarr.MovieStatus.RELEASED) {
    if (!movie.monitored) {
      return {
        ...shared,
        color: '#bb2124',
        description: `Not currently monitored!`,
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
      description: 'Now available on jellyfin!',
    };
  }

  if (show.status !== Sonarr.SeriesStatus.UPCOMING) {
    if (!show.id) {
      return {
        ...shared,
        color: '#bb2124',
        description: `Not currently monitored!`,
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
