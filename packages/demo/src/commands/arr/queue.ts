import { Flarie } from '@flarie/core';
import { Radarr } from '../../services/radarr';
import { config } from '../../config';
import dedent from 'dedent';
import { Sonarr } from '../../services/sonarr';

export function addQueueCommand(flarie: Flarie, sonarr: Sonarr, radarr: Radarr) {
  flarie.register('queue', async ({ message }) => {
    await message.typing();

    const [sonarrQueue, sonarrWanted, radarrQueue, radarrWanted] = await Promise.all([
      sonarr.getEntireQueue(),
      sonarr.getEntireWanted(),
      radarr.getEntireQueue(),
      radarr.getEntireWanted(),
    ]);

    const upgrades = {
      sonarr: sonarrQueue.filter((item) => sonarrWanted.every((episode) => episode.id !== item.episodeId)),
      radarr: radarrQueue.filter((item) => radarrWanted.every((movie) => movie.id !== item.movieId)),
    };

    const byId = {
      sonarr: sonarrQueue.reduce<Record<number, Sonarr.QueueResource>>((output, item) => {
        if (item.episodeId) {
          output[item.episodeId] = item;
        }

        return output;
      }, {}),
      radarr: radarrQueue.reduce<Record<number, Radarr.QueueResource>>((output, item) => {
        if (item.movieId) {
          output[item.movieId] = item;
        }

        return output;
      }, {}),
    };

    const bySeries = Object.values(
      sonarrWanted.reduce<
        Record<
          number,
          {
            id: number;
            title: string | null;
            slug: string;
            records: Sonarr.EpisodeResource[];
            queued: number;
          }
        >
      >((output, item) => {
        if (output[item.seriesId]) {
          output[item.seriesId]!.records.push(item);
        } else {
          output[item.seriesId] = {
            id: item.seriesId,
            title: item.series.title,
            slug: item.series.titleSlug,
            records: [item],
            queued: 0,
          };
        }

        // If the item is queued then increment
        if (byId.sonarr[item.id]) {
          output[item.seriesId]!.queued += 1;
        }

        return output;
      }, {})
    );

    const moviesByStatus = radarrWanted
      .map(({ id, ...item }) => ({
        ...item,
        id,
        queued: !!byId.radarr[id],
      }))
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
      })
      .reduce<Record<Radarr.MovieStatus, (Radarr.MovieResource & { queued: boolean })[]>>(
        (output, movie) => {
          output[movie.status].push(movie);
          return output;
        },
        {
          [Radarr.MovieStatus.ANNOUNCED]: [],
          [Radarr.MovieStatus.DELETED]: [],
          [Radarr.MovieStatus.IN_CINEMAS]: [],
          [Radarr.MovieStatus.RELEASED]: [],
          [Radarr.MovieStatus.TO_BE_ANNOUNCED]: [],
        }
      );

    await message.reply({
      embeds: [
        {
          color: '#f19cbb',
          title: `Shows (${sonarrQueue.length} / ${sonarrWanted.length + upgrades.sonarr.length})`,
          description: dedent`
          ${[
            upgrades.sonarr.length > 0 &&
              dedent`
              **⚙️ Upgrades**
              ${upgrades.sonarr.map((item) => `- 🟢 [${item.series?.title} - Season ${item.episode?.seasonNumber} Episode ${item.episode?.episodeNumber}](${config.sonarr.url}/series/${item.series?.titleSlug})`)}
            `,
            bySeries.length > 0 &&
              dedent`
              **✨ New**
              ${Object.values(bySeries)
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
                })
                .map(
                  ({ title, slug, queued, records }) =>
                    `- ${queued === records.length ? '🟢' : queued > 0 ? '🟡' : '🔴'} [${title}](${config.sonarr.url}/series/${slug}) (${queued > 0 ? `${queued}/` : ''}${records.length})`
                )
                .join('\n')}
            `,
          ]
            .filter(Boolean)
            .join('\n\n')}
          `,
        },
        {
          color: '#f19cbb',
          title: `Movies (${radarrQueue.length} / ${moviesByStatus.released.length + upgrades.radarr.length})`,
          description: dedent`
          ${[
            upgrades.radarr.length > 0 &&
              dedent`
              **⚙️ Upgrades**
              ${upgrades.radarr.map((item) => `- 🟢 [${item.movie?.title}](${config.radarr.url}/movie/${item.movie?.titleSlug})`)}
            `,
            moviesByStatus.released.length > 0 &&
              dedent`
              **Released**
              ${moviesByStatus.released.map(({ title, queued, titleSlug }) => `- ${queued ? '🟢' : '🔴'} [${title}](${config.radarr.url}/movie/${titleSlug})`).join('\n')}
            `,
            moviesByStatus.inCinemas.length > 0 &&
              dedent`
              **🍿 In Cinemas**
              ${moviesByStatus.inCinemas.map(({ title, titleSlug }) => `- [${title}](${config.radarr.url}/movie/${titleSlug})`).join('\n')}
            `,
            (moviesByStatus.announced.length > 0 || moviesByStatus.tba.length > 0) &&
              dedent`
              **🎤 Announced**
              ${[...moviesByStatus.announced, ...moviesByStatus.tba].map(({ title, titleSlug }) => `- [${title}](${config.radarr.url}/movie/${titleSlug})`).join('\n')}
            `,
            moviesByStatus.deleted.length > 0 &&
              dedent`
              **🗑️ Deleted**
              ${moviesByStatus.deleted.map(({ title, titleSlug }) => `- [${title}](${config.radarr.url}/movie/${titleSlug})`).join('\n')}
            `,
          ]
            .filter(Boolean)
            .join('\n\n')}
          `,
        },
      ],
    });
  });
}
