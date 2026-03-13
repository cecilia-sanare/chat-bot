import { Flarie, FlariePlatform } from '@flarie/core';
import { config, defined } from '../config';
import { Tidal } from '../services/tidal';
import { MusicManager } from '../services/music';
import dedent from 'dedent';
import { RibbonLogger } from '@ribbon-studios/logger';
import { Tiddl } from '../services/tiddl';
import { ReadStream } from 'fs';

const logger = new RibbonLogger('music');

export function addMusicCommands(flarie: Flarie) {
  if (!defined.tidal(config.tidal)) return;

  const tidal = new Tidal(config.tidal);
  const music = new MusicManager();

  const next = async (
    platform: FlariePlatform,
    guildId: string | undefined,
    channelId: string | undefined,
    externalTrack?: Tidal.Track
  ) => {
    if (!guildId || !channelId) return;

    const track = externalTrack ?? music.next(guildId);

    if (!track) return;

    let stream: ReadStream;

    try {
      stream = await tidal.stream(guildId, track.id);
    } catch (error) {
      if (error instanceof Tiddl.LoginRequired) {
        const client = tidal.getClient(guildId);

        client.once('login:required', async ({ url }) => {
          await platform.send(channelId, {
            embeds: [
              {
                title: `Auth Required! ~ 🎸 Music`,
                description: `Please authenticate Tidal @ ${url}`,
                color: '#bb2124',
              },
            ],
          });
        });

        await client.login();
        stream = await tidal.stream(guildId, track.id);
      } else {
        throw error;
      }
    }

    await platform.play(guildId, stream);
  };

  for (const platform of flarie.platforms) {
    platform.on('audio:playing', async ({ guildId, channelId }) => {
      const track = music.current(guildId);

      if (!track) {
        throw new Error('Unable to determine currently playing track!');
      }

      await platform.send(channelId, {
        embeds: [
          {
            title: `Now Playing! ~ 🎸 Music`,
            fields: [
              {
                name: 'Title',
                value: `${track.title} (${track.album})`,
              },
              {
                name: 'Artists',
                value: track.artists.map((artist) => artist.name).join(', '),
              },
            ],
            color: '#53a653',
            thumbnail: track.artwork,
          },
        ],
      });

      // Preload the next track
      const nextTrack = music.peek(guildId);

      if (!nextTrack) return;

      try {
        await tidal.download(guildId, nextTrack.id);
      } catch (error) {
        if (error instanceof Tiddl.LoginRequired) {
          const client = tidal.getClient(guildId);

          client.once('login:required', async ({ url }) => {
            await platform.send(channelId, {
              embeds: [
                {
                  title: `Auth Required! ~ 🎸 Music`,
                  description: `Please authenticate Tidal @ ${url}`,
                  color: '#bb2124',
                },
              ],
            });
          });

          await client.login();
          await tidal.download(guildId, nextTrack.id);
        } else {
          throw error;
        }
      }
    });

    platform.on('audio:paused', async ({ channelId }) => {
      await platform.send(channelId, {
        embeds: [
          {
            title: `Now Paused! ~ 🎸 Music`,
            description: 'Music playback is now paused!',
            footer: 'Type unpause to resume playback!',
            color: '#53a653',
          },
        ],
      });
    });

    platform.on('audio:idle', ({ guildId, channelId }) => next(platform, guildId, channelId));
  }

  music.on('fresh', async ({ guildId, track }) => {
    // TODO: Figure out how to handle this
    await tidal.download(guildId, track.id);
  });

  flarie.register('playing', async ({ message, platform }) => {
    if (!message.guildId) return;

    await message.typing();

    const track = music.current(message.guildId);

    if (!track) {
      return await message.reply({
        embeds: [
          {
            title: `Now Playing! ~ 🎸 Music`,
            description: dedent`
              Nothing is playing at the moment.
              How about queuing something up? ^_^
            `,
          },
        ],
      });
    }

    await message.reply({
      embeds: [
        {
          title: `Now Playing! ~ 🎸 Music`,
          fields: [
            {
              name: 'Title',
              value: `${track.title} (${track.album})`,
            },
            {
              name: 'Artists',
              value: track.artists.map((artist) => artist.name).join(', '),
            },
          ],
          color: '#53a653',
          thumbnail: track.artwork,
        },
      ],
    });
  });

  flarie.register('join', async ({ message, platform }) => {
    if (!message.guildId) return;

    const { voiceChannelId } = message.author;

    if (!voiceChannelId) {
      return await message.reply(`Uh, oh! Looks like you're not currently in a voice channel!`);
    }

    await platform.join(voiceChannelId);
  });

  flarie.register('leave', async ({ message, platform }) => {
    if (!message.guildId) return;

    await platform.leave(message.guildId);

    music.clear(message.guildId);
  });

  flarie.register('skip', async ({ message, platform }) => {
    if (!message.guildId) return;

    await message.typing();

    const track = music.next(message.guildId);

    if (!track) {
      if (platform.playing(message.guildId)) {
        await platform.stop(message.guildId);
      }

      return await message.reply({
        content: 'Theres nothing left in the queue!',
      });
    }

    await next(platform, message.guildId, message.channelId, track);
  });

  flarie.register('queue', async ({ message }) => {
    if (!message.guildId) return;

    const current = music.current(message.guildId);
    const queue = music.lookup(message.guildId);

    if (!current && queue.length === 0) {
      return await message.reply({
        embeds: [
          {
            title: `Queue! ~ 🎸 Music`,
            description: 'The queues empty! Queue something up with `queue {url}`!',
          },
        ],
      });
    }

    const shortQueue = queue.slice(0, 20);

    return await message.reply({
      embeds: [
        {
          title: `Queue! ~ 🎸 Music`,
          description: [
            current && `**Currently Playing:** ${current.title}`,
            shortQueue.length > 0 &&
              dedent`
              **Backlog**
              ${[
                ...shortQueue.map((track) => `1. ${track.url ? `[${track.title}](${track.url})` : track.title}`),
                queue.length > shortQueue.length && `1. ${queue.length - shortQueue.length} more items...`,
              ]
                .filter(Boolean)
                .join('\n')}
            `,
          ]
            .filter(Boolean)
            .join('\n\n'),
          thumbnail: current?.artwork,
        },
      ],
    });
  });

  flarie.register('queue {url}', async ({ message, args, platform }) => {
    const { url } = args;

    if (!url || !message.guildId) return;

    const { voiceChannelId } = message.author;

    await message.typing();

    if (!voiceChannelId) {
      return await message.reply(`Uh, oh! Looks like you're not currently in a voice channel!`);
    }

    if (!platform.connected(message.guildId)) {
      await platform.join(voiceChannelId);
    }

    try {
      const id = tidal.parse(url);

      if (!id) throw new Error(`Invalid url: ${url}`);

      if (id.type === 'playlist') {
        const playlist = await tidal.getPlaylist(id);

        if (!playlist) {
          throw new Error('Failed to request the playlist!');
        }

        music.queue(message.guildId, ...playlist.tracks);

        if (!platform.playing(message.guildId)) {
          return await next(platform, message.guildId, message.channelId);
        }

        await message.reply({
          embeds: [
            {
              title: `Added to the queue! ~ 🎸 Music`,
              fields: [
                {
                  name: 'Title',
                  value: playlist.title,
                },
                {
                  name: 'Artists',
                  value: `${playlist.tracks.length} songs`,
                },
              ],
              color: '#53a653',
              thumbnail: playlist.artwork,
            },
          ],
        });
      } else if (id.type === 'track') {
        const track = await tidal.getTrack(id);

        if (!track) {
          throw new Error('Failed to request the song!');
        }

        music.queue(message.guildId, track);

        if (!platform.playing(message.guildId)) {
          return await next(platform, message.guildId, message.channelId);
        }

        await message.reply({
          embeds: [
            {
              title: `Added to the queue! ~ 🎸 Music`,
              fields: [
                {
                  name: 'Title',
                  value: `${track.title} (${track.album})`,
                },
                {
                  name: 'Artists',
                  value: track.artists.map((artist) => artist.name).join(', '),
                },
              ],
              color: '#53a653',
              thumbnail: track.artwork,
            },
          ],
        });
      } else {
        throw new Error(`Unknown id type. ${id.type}`);
      }
    } catch (error) {
      logger.error(error);
      throw new Error('Failed to request the song!');
    }
  });

  flarie.register('pause', async ({ message, platform }) => {
    if (!message.guildId) return;

    await platform.pause(message.guildId);
  });

  flarie.register(['unpause', 'resume'], async ({ message, platform }) => {
    if (!message.guildId) return;

    await platform.unpause(message.guildId);
  });
}

export namespace Music {
  export type Guild = {
    voiceChannelId: string;
    queue: Tidal.Track[];
  };
}
