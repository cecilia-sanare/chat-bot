import {
  ActivityType,
  Client,
  Events,
  GatewayIntentBits,
  MessageCreateOptions,
  MessageReferenceType,
  MessageReplyOptions,
  Partials,
} from 'discord.js';
import {
  FlariePlatform,
  FlarieIncomingMessage,
  FlarieUser,
  FlarieOutgoingMessage,
  color,
  MessageType,
} from '@flarie/core';
import {
  joinVoiceChannel,
  createAudioResource,
  createAudioPlayer,
  NoSubscriberBehavior,
  AudioPlayerStatus,
  StreamType,
  entersState,
  VoiceConnectionStatus,
  getVoiceConnection,
  AudioPlayer,
} from '@discordjs/voice';
import { ReadStream } from 'node:fs';
import { RibbonLogger } from '@ribbon-studios/logger';

const logger = new RibbonLogger('discord');

export class DiscordPlatform extends FlariePlatform {
  override name: string = 'Discord';

  #client: Client;
  #bot?: FlarieUser;
  #players = new Map<string, AudioPlayer>();

  constructor({ token, status }: DiscordPlatform.Options) {
    super();

    this.#client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates, // required for voice
      ],
      partials: [Partials.Channel],

      presence: {
        status: 'online',
        activities: status
          ? [
              {
                type: ActivityType.Custom,
                name: status,
              },
            ]
          : [],
      },
    });

    this.#client.on(Events.MessageCreate, async (incomingMessage) => {
      if (incomingMessage.author.bot) return;

      const incomingFlarieMessage: FlarieIncomingMessage = {
        messageId: incomingMessage.id,
        guildId: incomingMessage.guildId ?? undefined,
        channelId: incomingMessage.channelId,
        author: {
          id: incomingMessage.author.id,
          username: incomingMessage.author.username,
          displayName: incomingMessage.author.globalName,
          voiceChannelId: incomingMessage.member?.voice.channel?.id,
        },
        content: incomingMessage.content,

        typing: incomingMessage.channel.sendTyping.bind(incomingMessage.channel),

        reply: async (outgoingMessage) => {
          const outgoingFlarieMessage: FlarieOutgoingMessage =
            typeof outgoingMessage === 'string'
              ? {
                  content: outgoingMessage,
                }
              : outgoingMessage;

          await incomingMessage.reply(this.toMessage(outgoingFlarieMessage));
        },
      };

      this.emit('message', {
        platform: this,
        message: incomingFlarieMessage,
        bot: this.#bot,
      });
    });

    this.#client.on(Events.ClientReady, () => {
      this.status = FlariePlatform.Status.READY;
    });

    this.#client.on(Events.ShardDisconnect, () => {
      this.status = FlariePlatform.Status.DISCONNECTED;
    });

    this.#client.on(Events.ShardReconnecting, () => {
      this.status = FlariePlatform.Status.RECONNECTING;
    });

    this.#client.on(Events.ShardResume, () => {
      this.status = FlariePlatform.Status.RESUMED;
    });

    const interval = setInterval(() => {
      logger.warn('May be down at the moment, please be patient!');
    }, 10000);

    this.#client.once(Events.ClientReady, (client) => {
      clearInterval(interval);

      this.#bot = {
        id: client.user.id,
        username: client.user.username,
        displayName: client.user.globalName,
      };

      logger.info(`Logged in as ${this.#bot.username}!`);
    });

    try {
      const login = async () => {
        while (true) {
          try {
            await this.#client.login(token);
            return;
          } catch (error) {
            logger.error(`Failed to connect, discord may be down! We'll retry in 30 seconds!`);
            await new Promise((resolve) => setTimeout(resolve, 30000));
          }
        }
      };

      login();
    } catch (error) {
      logger.error('Failed to connect to the gateway!', error);
    }
  }

  playing(guildId: string): boolean {
    const player = this.#players.get(guildId);
    if (!player) return false;

    return player.state.status === AudioPlayerStatus.Playing;
  }

  #player(guildId: string): AudioPlayer {
    let player = this.#players.get(guildId);

    if (!player) {
      player = createAudioPlayer({
        behaviors: {
          noSubscriber: NoSubscriberBehavior.Pause,
        },
      });

      player.on(AudioPlayerStatus.Playing, (oldState) => {
        const connection = getVoiceConnection(guildId);

        if (!connection) throw new Error(`Failed to get connection for ${guildId}`);

        const { channelId } = connection.joinConfig;
        if (!channelId) throw new Error('Connection not joined to a voice channel');

        // If we were previously idle then we're resuming, otherwise we're playing something new
        if (oldState.status === AudioPlayerStatus.Paused) {
          this.emit('audio:resume', { guildId, channelId });
        } else if (oldState.status !== AudioPlayerStatus.AutoPaused) {
          this.emit('audio:playing', { guildId, channelId });
        }
      });

      player.on(AudioPlayerStatus.Paused, () => {
        const connection = getVoiceConnection(guildId);

        if (!connection) throw new Error(`Failed to get connection for ${guildId}`);

        const { channelId } = connection.joinConfig;
        if (!channelId) throw new Error('Connection not joined to a voice channel');

        this.emit('audio:paused', { guildId, channelId });
      });

      player.on(AudioPlayerStatus.Idle, (oldState) => {
        const connection = getVoiceConnection(guildId);

        if (!connection) throw new Error(`Failed to get connection for ${guildId}`);

        const { channelId } = connection.joinConfig;
        if (!channelId) throw new Error('Connection not joined to a voice channel');

        this.emit('audio:idle', { guildId, channelId });
      });

      player.on('error', logger.error);

      this.#players.set(guildId, player);
    }

    return player;
  }

  override connected(guildId: string): boolean {
    return getVoiceConnection(guildId) !== undefined;
  }

  async join(voiceChannelId: string) {
    const channel = this.#client.channels.resolve(voiceChannelId);

    if (!channel) throw new Error('Channel not found');
    if (channel.isDMBased()) throw new Error('Voice Connections are not supported in DMs!');

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guildId,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: true,
    });

    connection.on('stateChange', (oldState, newState) => {
      logger.info(`Connection: ${oldState.status} -> ${newState.status}`);
    });

    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
    } catch {
      connection.destroy();
      throw new Error('Failed to join voice channel within 30s');
    }
  }

  async leave(guildId: string) {
    const connection = getVoiceConnection(guildId);

    if (!connection) return false;

    return connection.disconnect();
  }

  async play(guildId: string, stream: ReadStream) {
    const connection = getVoiceConnection(guildId);

    if (!connection) throw new Error('Not connected to a voice channel');

    const resource = createAudioResource(stream, {
      inputType: StreamType.OggOpus,
    });

    resource.volume?.setVolume(0.02);

    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
    } catch {
      connection.destroy();
      throw new Error('Failed to join voice channel within 30s');
    }

    const player = this.#player(guildId);

    connection.subscribe(player);
    player.play(resource);
  }

  override async stop(guildId: string): Promise<void> {
    const player = this.#player(guildId);

    if (player.stop()) {
      player.removeAllListeners();
      this.#players.delete(guildId);
    }
  }

  override async pause(guildId: string): Promise<void> {
    const player = this.#player(guildId);

    player.pause();
  }

  override async unpause(guildId: string): Promise<void> {
    const player = this.#player(guildId);

    player.unpause();
  }

  override async send(channelId: string, message: FlarieOutgoingMessage | string): Promise<string> {
    const channel = this.#client.channels.cache.get(channelId);

    if (!channel) {
      throw new Error(`Specified channel does not exist. (${channelId})`);
    }

    if (!channel.isSendable()) {
      throw new Error(`Channel does not support sending messages. (${channelId})`);
    }

    const { id } = await channel.send(this.toMessage(message));
    return id;
  }

  override mention(id?: string): string | undefined {
    if (!id) return undefined;

    return `<@${id}>`;
  }

  private toMessage(message: string | FlarieOutgoingMessage): MessageCreateOptions | MessageReplyOptions {
    if (typeof message === 'string') {
      return {
        content: message,
      };
    }

    return {
      // flags: message.ephemeral ? MessageFlags.Ephemeral : undefined,
      content: message.content,
      embeds: message.embeds?.map((embed) => ({
        ...embed,
        color: color(embed.color),
        image: typeof embed.image === 'string' ? { url: embed.image } : embed.image,
        thumbnail: typeof embed.thumbnail === 'string' ? { url: embed.thumbnail } : embed.thumbnail,
        footer: typeof embed.footer === 'string' ? { text: embed.footer } : embed.footer,
        author: typeof embed.author === 'string' ? { name: embed.author } : embed.author,
      })),
    };
  }
}

export namespace DiscordPlatform {
  export type Options = {
    token: string;
    status?: string;
  };

  export const FLARIE_TO_DISCORD_MESSAGE_TYPE: Record<MessageType, MessageReferenceType> = {
    [MessageType.Reply]: MessageReferenceType.Default,
    [MessageType.Forward]: MessageReferenceType.Forward,
  };
}
