import { Client, Events, MessageSendOptions, Message } from '@fluxerjs/core';
import { FlariePlatform, FlarieUser, FlarieOutgoingMessage, color } from '@flarie/core';
import { getVoiceManager, VoiceManager } from '@fluxerjs/voice';
import { ReadStream } from 'fs';

export class FluxerPlatform extends FlariePlatform {
  override name: string = 'Fluxer';

  #client: Client;
  #voiceManager: VoiceManager;
  #bot?: FlarieUser;

  constructor({ token, status }: FluxerPlatform.Options) {
    super();

    this.#client = new Client({
      intents: 0,
      presence: {
        status: 'online',
        custom_status: {
          text: status,
        },
      },
    });
    this.#voiceManager = getVoiceManager(this.#client);

    this.#client.on(Events.MessageCreate, async (message: Message) => {
      const voiceChannelId =
        (message.guildId && this.#voiceManager.getVoiceChannelId(message.guildId, message.author.id)) || undefined;

      this.emit('message', {
        platform: this,
        message: {
          messageId: message.id,
          guildId: message.guildId ?? undefined,
          channelId: message.channelId,
          author: {
            id: message.author.id,
            username: message.author.username,
            displayName: message.author.globalName,
            voiceChannelId,
          },
          content: message.content,

          typing: async () => {
            await message.channel?.sendTyping();
          },

          reply: async (response) => {
            await message.reply(this.toMessage(response));
          },
        },
        bot: this.#bot,
      });
    });

    this.#client.on(Events.Ready, () => {
      this.status = FlariePlatform.Status.READY;
    });

    // this.#client.on(Events.ShardDisconnect, () => {
    //   this.status = FlariePlatform.Status.DISCONNECTED;
    // });

    // this.#client.on(Events.ShardReconnecting, () => {
    //   this.status = FlariePlatform.Status.RECONNECTING;
    // });

    this.#client.on(Events.Resumed, () => {
      this.status = FlariePlatform.Status.RESUMED;
    });

    this.#client.on(Events.Ready, () => {
      if (!this.#client.user) {
        throw new Error('[Fluxer] Login succeeded, but no bot user is present!');
      }

      this.#bot = {
        id: this.#client.user.id,
        username: this.#client.user.username,
        displayName: this.#client.user.globalName,
      };

      console.log(`[Fluxer] Logged in as ${this.#bot.username}!`);
    });

    try {
      const login = async () => {
        while (true) {
          try {
            await this.#client.login(token);
            return;
          } catch (error) {
            console.warn(`[Fluxer] Failed to connect, fluxer may be down! We'll retry in 30 seconds!`);
            await new Promise((resolve) => setTimeout(resolve, 30000));
          }
        }
      };

      login();
    } catch (error) {
      console.error('Failed to connect to the gateway!', error);
    }
  }

  override async send(channelId: string, message: FlarieOutgoingMessage): Promise<string> {
    const { id } = await this.#client.channels.send(channelId, this.toMessage(message));

    return id;
  }

  override mention(id?: string): string | undefined {
    if (!id) return undefined;

    return `<@${id}>`;
  }

  override async join(channelId: string): Promise<void> {
    const channel = await this.#client.channels.fetch(channelId);

    if (!channel) throw new Error('Channel not found');
    if (!channel.isVoice()) throw new Error('Voice Connections are not supported in DMs!');

    const connection = await this.#voiceManager.join(channel);

    connection.on('serverLeave', async () => {
      try {
        await this.#voiceManager.join(channel);
      } catch (e) {
        console.error('Auto-reconnect failed:', e);
      }
    });
  }

  override async leave(guildId: string): Promise<boolean> {
    const connection = this.#voiceManager.getConnection(guildId);

    if (!connection) return false;

    this.#voiceManager.leave(guildId);

    return true;
  }

  override connected(guildId: string): boolean {
    return this.#voiceManager.getConnection(guildId) !== undefined;
  }

  playing(guildId: string): boolean {
    const connection = this.#voiceManager.getConnection(guildId);

    return connection?.playing ?? false;
  }

  // connected, playing

  async play(guildId: string, stream: ReadStream) {
    const connection = this.#voiceManager.getConnection(guildId);

    if (!connection) throw new Error('Not connected to a voice channel');

    connection.on('stateChange', (oldState, newState) => {
      console.log(`Connection: ${oldState.status} -> ${newState.status}`);
    });

    connection.playOpus(stream);

    this.#client.on(Events.VoiceStateUpdate, (data) => console.log(data));
    this.#client.on(Events.VoiceServerUpdate, (data) => console.log(data));

    // player.on(AudioPlayerStatus.Playing, () =>
    //   this.emit('audio:playing', { guildId, channelId: connection.channel.id })
    // );
    // player.on(AudioPlayerStatus.Idle, () => this.emit('audio:idle', { guildId, channelId: connection.channel.id }));

    // player.on('error', console.error);

    // connection.subscribe(player);
    // player.play(resource);
  }

  override async stop(guildId: string): Promise<void> {
    const connection = this.#voiceManager.getConnection(guildId);

    if (!connection) return;

    connection.stop();
  }

  override async pause(guildId: string): Promise<void> {
    const connection = this.#voiceManager.getConnection(guildId);

    if (!connection) return;

    // TODO: Implement this
    // connection.();
  }

  override async unpause(guildId: string): Promise<void> {
    const connection = this.#voiceManager.getConnection(guildId);

    if (!connection) return;

    // TODO: Implement this
    // connection.unpause();
  }

  private toMessage(message: string): string;
  private toMessage(message: FlarieOutgoingMessage): MessageSendOptions;
  private toMessage(message: FlarieOutgoingMessage | string): MessageSendOptions | string;
  private toMessage(message: FlarieOutgoingMessage | string): MessageSendOptions | string {
    if (typeof message === 'string') return message;

    return {
      // flags: this.toFlags(message),
      content: message.content,
      embeds: message.embeds?.map((embed) => ({
        ...embed,
        color: color(embed.color),
        image: typeof embed.image === 'string' ? { url: embed.image } : embed.image,
        thumbnail: typeof embed.thumbnail === 'string' ? { url: embed.thumbnail } : embed.thumbnail,
        footer: typeof embed.footer === 'string' ? { text: embed.footer } : embed.footer,
        author: typeof embed.author === 'string' ? { name: embed.author } : embed.author,
      })),
      // message_reference: message.reference
      //   ? {
      //       type: message.reference.type
      //         ? FluxerPlatform.FLARIE_TO_FLUXER_MESSAGE_TYPE[message.reference.type]
      //         : undefined,
      //       message_id: message.reference.messageId,
      //       channel_id: message.reference.channelId,
      //       guild_id: message.reference.guildId,
      //     }
      //   : undefined,
    };
  }

  // private toFlags(message?: FlarieOutgoingMessage): MessageFlags | undefined {
  //   if (message?.ephemeral) return MessageFlags.Ephemeral;
  // }
}

export namespace FluxerPlatform {
  export type Options = {
    token: string;
    status?: string;
  };

  // export const FLARIE_TO_FLUXER_MESSAGE_TYPE: Record<MessageType, MessageReferenceType> = {
  //   [MessageType.Reply]: MessageReferenceType.Default,
  //   [MessageType.Forward]: MessageReferenceType.Forward,
  // };
}
