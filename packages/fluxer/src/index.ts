import { Client, Events, MessageSendOptions, Message } from '@fluxerjs/core';
import {
  FlariePlatform,
  FlarieIncomingMessage,
  FlarieUser,
  FlarieOutgoingMessage,
  color,
  MessageType,
} from '@flarie/core';

export class FluxerPlatform extends FlariePlatform {
  #client: Client;
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

    this.#client.on(Events.MessageCreate, async (message: Message) => {
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
          },
          content: message.content,

          reply: async (response) => {
            await message.reply(this.toMessage(response));
          },
        },
        bot: this.#bot,
      });
    });

    const timeout = setTimeout(() => {
      console.log('[Fluxer] May be down at the moment, please be patient!');
    }, 10000);

    this.#client.on(Events.Ready, () => {
      clearTimeout(timeout);

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
      this.#client.login(token);
    } catch {
      console.error('Failed to connect to the gateway!');
      process.exit(1);
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

  private toMessage(message: string): string;
  private toMessage(message: FlarieOutgoingMessage): MessageSendOptions;
  private toMessage(message: FlarieOutgoingMessage | string): MessageSendOptions | string;
  private toMessage(message: FlarieOutgoingMessage | string): MessageSendOptions | string {
    if (typeof message === 'string') return message;

    return {
      // flags: this.toFlags(message),
      content: message.content,
      embeds: message.embeds?.map((embed) => ({
        title: embed.title,
        color: color(embed.color),
        description: embed.description,
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
