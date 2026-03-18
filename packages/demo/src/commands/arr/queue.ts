import { Flarie, FlarieEmbed } from '@flarie/core';
import { Radarr } from '../../services/radarr';
import { Sonarr } from '../../services/sonarr';
import { groupBy } from '../../utils/array';
import dedent from 'dedent';
import { config } from '../../config';

export function addQueueCommand(flarie: Flarie, sonarr: Sonarr, radarr: Radarr) {
  flarie.register('activity', async ({ message }) => {
    await message.typing();

    const embeds = await Promise.all([getMoviesEmbed(radarr), getShowsEmbed(sonarr)]);

    await message.reply({
      embeds,
    });
  });
}

const MOVIE_STATUS_TO_HEADER: Record<Radarr.MovieStatus, string> = {
  [Radarr.MovieStatus.RELEASED]: 'Released',
  [Radarr.MovieStatus.IN_CINEMAS]: '🍿 In Cinemas',
  [Radarr.MovieStatus.ANNOUNCED]: '🎤 Announced',
  [Radarr.MovieStatus.TO_BE_ANNOUNCED]: '🎤 To Be Announced',
  [Radarr.MovieStatus.DELETED]: '🗑️ Deleted',
};

const MOVIE_STATUS_ORDER: Radarr.MovieStatus[] = [
  Radarr.MovieStatus.RELEASED,
  Radarr.MovieStatus.IN_CINEMAS,
  Radarr.MovieStatus.ANNOUNCED,
  Radarr.MovieStatus.TO_BE_ANNOUNCED,
  Radarr.MovieStatus.DELETED,
];

export async function getMoviesEmbed(radarr: Radarr): Promise<FlarieEmbed> {
  const [queue, wanted] = await Promise.all([
    radarr.getEntireQueue({
      includeMovie: true,
    }),
    radarr.getEntireWanted(),
  ]);

  const upgrades = queue.filter((item) => wanted.every((movie) => movie.id !== item.movieId));

  const movies = wanted
    .map((movie) => {
      const item = queue.find((item) => item.movieId === movie.id);

      return {
        ...movie,
        queued: !!item,
      };
    })
    .sort((a, b) => {
      const title = {
        a: a.title?.replace(/^(The|A)\s/i, '') ?? '',
        b: b.title?.replace(/^(The|A)\s/i, '') ?? '',
      };

      return title.a.localeCompare(title.b);
    })
    .sort((a, b) => {
      if (a.status === b.status) return 0;
      if (a.status === 'released') return -1;
      if (b.status === 'released') return 1;

      return 0;
    })
    .sort((a, b) => {
      if (a.queued === b.queued) return 0;
      if (a.queued) return -1;
      return 1;
    });

  const byStatus = groupBy(movies, 'status');

  const sections: string[] = [];

  if (upgrades.length > 0) {
    sections.push(dedent`
      **⚙️ Upgrades**
      ${upgrades.map((item) => `- 🟢 [${item.movie?.title}](${config.radarr.url}/movie/${item.movie?.titleSlug})`).join('\n')}
    `);
  }

  const statuses = MOVIE_STATUS_ORDER.filter((status) => byStatus[status]);

  sections.push(
    ...statuses.map(
      (status) => dedent`
        **${MOVIE_STATUS_TO_HEADER[status]}**
        ${byStatus[status]?.map(getMovieLine).join('\n')}
      `
    )
  );

  if (sections.length > 0) {
    return {
      color: '#f19cbb',
      title: `Movies (${queue.length} / ${wanted.length + upgrades.length})`,
      description: sections.join('\n'),
    };
  }

  return {
    color: '#f19cbb',
    title: 'Movies',
    description: 'There are no movies queue at the moment!',
  };
}

const SERIES_STATUS_TO_HEADER: Record<Sonarr.SeriesStatus, string> = {
  [Sonarr.SeriesStatus.CONTINUING]: '🍿 Continuing',
  [Sonarr.SeriesStatus.DELETED]: '🗑️ Deleted',
  [Sonarr.SeriesStatus.ENDED]: '🏁 Ended',
  [Sonarr.SeriesStatus.UPCOMING]: '🎤 Upcoming',
};

const SERIES_STATUS_ORDER: Sonarr.SeriesStatus[] = [
  Sonarr.SeriesStatus.CONTINUING,
  Sonarr.SeriesStatus.ENDED,
  Sonarr.SeriesStatus.UPCOMING,
  Sonarr.SeriesStatus.DELETED,
];

export async function getShowsEmbed(sonarr: Sonarr): Promise<FlarieEmbed> {
  const [queue, wanted] = await Promise.all([
    sonarr.getEntireQueue({
      includeSeries: true,
      includeEpisode: true,
    }),
    sonarr.getEntireWanted(),
  ]);

  const episodes = wanted
    .map((episode) => ({
      ...episode,
      queued: queue.some((item) => item.episodeId === episode.id),
    }))
    .sort((a, b) => {
      const title = {
        a: a.title?.replace(/^(The|A)\s/i, '') ?? '',
        b: b.title?.replace(/^(The|A)\s/i, '') ?? '',
      };

      return title.a.localeCompare(title.b);
    })
    .sort((a, b) => {
      if (a.queued === b.queued) return 0;
      if (a.queued) return -1;
      return 1;
    });

  const upgrades = queue.filter((item) => wanted.every((episode) => episode.id !== item.episodeId));

  const sections: string[] = [];

  if (upgrades.length > 0) {
    sections.push(dedent`
      **⚙️ Upgrades**
      ${upgrades.map((item) => `- 🟢 [${item.series?.title} - Season ${item.episode?.seasonNumber} Episode ${item.episode?.episodeNumber}](${config.sonarr.url}/series/${item.series?.titleSlug})`).join('\n')}
    `);
  }

  if (episodes.length > 0) {
    const shows = Object.values(
      episodes.reduce<
        Record<
          number,
          {
            id: number;
            title: string | null;
            slug: string;
            status: Sonarr.SeriesStatus;
            episodes: Sonarr.EpisodeResource[];
            queued: number;
          }
        >
      >((output, episode) => {
        if (output[episode.seriesId]) {
          output[episode.seriesId]!.episodes.push(episode);
        } else {
          output[episode.seriesId] = {
            id: episode.seriesId,
            title: episode.series.title,
            slug: episode.series.titleSlug,
            status: episode.series.status,
            episodes: [episode],
            queued: 0,
          };
        }

        // If the item is queued then increment
        if (episode.queued) {
          output[episode.seriesId]!.queued += 1;
        }

        return output;
      }, {})
    ).flat();

    const byStatus = groupBy(shows, 'status');

    const statuses = SERIES_STATUS_ORDER.filter((status) => byStatus[status]);

    sections.push(
      ...statuses.map(
        (status) => dedent`
        **${SERIES_STATUS_TO_HEADER[status]}**
        ${byStatus[status]?.map(getShowLine).join('\n')}
      `
      )
    );
  }

  if (sections.length > 0) {
    return {
      color: '#f19cbb',
      title: `Shows (${queue.length} / ${wanted.length + upgrades.length})`,
      description: sections.join('\n'),
    };
  }

  return {
    color: '#f19cbb',
    title: 'Shows',
    description: 'There are no shows queue at the moment!',
  };
}

export function getMovieLine({
  title,
  queued,
  titleSlug,
  status,
}: Radarr.MovieResource & { queued?: boolean }): string {
  switch (status) {
    case Radarr.MovieStatus.RELEASED:
      return `- ${queued ? '🟢' : '🔴'} [${title}](${config.radarr.url}/movie/${titleSlug})`;
    default:
      return `- [${title}](${config.radarr.url}/movie/${titleSlug})`;
  }
}

export function getShowLine({ title, queued, slug, status, episodes }: Show): string {
  switch (status) {
    case Sonarr.SeriesStatus.CONTINUING:
    case Sonarr.SeriesStatus.ENDED:
      return `- ${queued === episodes.length ? '🟢' : queued > 0 ? '🟡' : '🔴'} [${title}](${config.sonarr.url}/series/${slug}) (${queued > 0 ? `${queued}/` : ''}${episodes.length})`;
    default:
      return `- [${title}](${config.sonarr.url}/series/${slug})`;
  }
}

type Show = {
  id: number;
  title: string | null;
  slug: string;
  status: Sonarr.SeriesStatus;
  episodes: Sonarr.EpisodeResource[];
  queued: number;
};
