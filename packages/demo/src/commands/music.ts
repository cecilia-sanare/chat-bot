import { Flarie, FlariePlatform } from '@flarie/core';
import { config, defined } from '../config';
import { Tidal } from '../services/tidal';
import { MusicManager } from '../services/music';

export function addMusicCommands(flarie: Flarie) {
  if (!defined.tidal(config.tidal)) return;

  const tidal = new Tidal(config.tidal);
  const music = new MusicManager();

  const next = async (platform: FlariePlatform, guildId: string | undefined, externalTrack?: Tidal.Track) => {
    if (!guildId) return;

    const track = externalTrack ?? music.next(guildId);

    if (!track) return;

    const stream = await tidal.stream(track.id);

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
            title: `Now Playing!`,
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

    platform.on('audio:paused', async ({ channelId }) => {
      await platform.send(channelId, {
        embeds: [
          {
            title: `Now Paused!`,
            description: 'Music playback is now paused!',
            footer: 'Type unpause to resume playback!',
            color: '#53a653',
          },
        ],
      });
    });

    platform.on('audio:idle', ({ guildId }) => next(platform, guildId));
  }

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

    await next(platform, message.guildId, track);
  });

  flarie.register('queue', async ({ message }) => {
    if (!message.guildId) return;

    const queue = music.lookup(message.guildId);

    if (queue.length === 0) {
      return await message.reply({
        embeds: [
          {
            title: `Queue`,
            description: 'The queues empty! Queue something up with `queue {url}`!',
          },
        ],
      });
    }

    const shortQueue = queue.slice(0, 5);

    return await message.reply({
      embeds: [
        {
          title: `Queue`,
          description: [
            ...shortQueue.map(
              (track) => `1. **${track.title}** _by ${track.artists.map((artist) => artist.name).join(', ')}_`
            ),
            queue.length > shortQueue.length && `1. ${queue.length - shortQueue.length} more items...`,
          ]
            .filter(Boolean)
            .join('\n'),
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
      const [track] = await Promise.all([tidal.getTrack(url), tidal.download(url)]);

      if (!track) {
        throw new Error('Failed to request the song!');
      }

      music.queue(message.guildId, track);

      if (!platform.playing(message.guildId)) {
        return await next(platform, message.guildId);
      }

      await message.reply({
        embeds: [
          {
            title: `Added to the Queue!`,
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
    } catch (error) {
      console.error(error);
      throw new Error('Failed to request the song!');
    }
  });

  flarie.register('pause', async ({ message, platform }) => {
    if (!message.guildId) return;

    await platform.pause(message.guildId);
  });

  flarie.register('unpause', async ({ message, platform }) => {
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
