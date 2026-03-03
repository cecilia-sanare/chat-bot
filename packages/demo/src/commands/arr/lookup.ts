import { Flarie } from '@flarie/core';
import { Radarr } from '../../services/radarr';
import { Sonarr } from '../../services/sonarr';

export function addLookupCommand(flarie: Flarie, sonarr: Sonarr, radarr: Radarr) {
  flarie.register('lookup {...name}', async ({ message, args }) => {
    const { name } = args;

    if (!name) return;

    await message.typing();

    const movies = await radarr.lookup(name);
    const [movie] = movies;

    if (!movie) {
      return await message.reply({
        content: 'Oops! We were unable to locate any movies with that name, sorry!',
      });
    }

    if (movie.movieFile) {
      return await message.reply({
        embeds: [
          {
            color: '#53a653',
            title: movie.title ?? undefined,
            description: 'Now available on jellyfin!',
            thumbnail: movie.remotePoster ?? undefined,
            url: `https://www.themoviedb.org/movie/${movie.tmdbId}`,
          },
        ],
      });
    }

    if (movie.status === Radarr.MovieStatus.RELEASED) {
      if (!movie.monitored) {
        return await message.reply({
          embeds: [
            {
              color: '#bb2124',
              title: movie.title ?? undefined,
              description: `Not currently monitored!`,
              thumbnail: movie.remotePoster ?? undefined,
              url: `https://www.themoviedb.org/movie/${movie.tmdbId}`,
            },
          ],
        });
      }

      return await message.reply({
        embeds: [
          {
            color: '#f0ad4e',
            title: movie.title ?? undefined,
            description: 'Actively being requested!',
            thumbnail: movie.remotePoster ?? undefined,
            url: `https://www.themoviedb.org/movie/${movie.tmdbId}`,
          },
        ],
      });
    }

    return await message.reply({
      embeds: [
        {
          color: '#bb2124',
          title: movie.title ?? undefined,
          description: `Hasn't been released yet!`,
          thumbnail: movie.remotePoster ?? undefined,
          url: `https://www.themoviedb.org/movie/${movie.tmdbId}`,
        },
      ],
    });
  });
}
