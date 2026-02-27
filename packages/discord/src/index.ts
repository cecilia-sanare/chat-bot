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

export class DiscordPlatform extends FlariePlatform {
  #client: Client;
  #bot?: FlarieUser;

  constructor({ token, status }: DiscordPlatform.Options) {
    super();

    this.#client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
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
      const incomingFlarieMessage: FlarieIncomingMessage = {
        messageId: incomingMessage.id,
        guildId: incomingMessage.guildId ?? undefined,
        channelId: incomingMessage.channelId,
        author: {
          id: incomingMessage.author.id,
          username: incomingMessage.author.username,
          displayName: incomingMessage.author.globalName,
        },
        content: incomingMessage.content,

        typing: incomingMessage.channel.sendTyping.bind(incomingMessage.channel),

        reply: async (outgoingMessage) => {
          const outgoingFlarieMessage: FlarieOutgoingMessage =
            typeof outgoingMessage === 'string'
              ? {
                  content: outgoingMessage,
                  reference: {
                    type: MessageType.Reply,
                    guildId: incomingMessage.guildId ?? undefined,
                    channelId: incomingMessage.channelId,
                    messageId: incomingMessage.id,
                  },
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

    const interval = setInterval(() => {
      console.log('[Discord] May be down at the moment, please be patient!');
    }, 10000);

    this.#client.once(Events.ClientReady, (client) => {
      clearInterval(interval);

      this.#bot = {
        id: client.user.id,
        username: client.user.username,
        displayName: client.user.globalName,
      };

      console.log(`[Discord] Logged in as ${this.#bot.username}!`);
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
    const channel = await this.#client.channels.cache.get(channelId);

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

  private toMessage(message: FlarieOutgoingMessage): MessageCreateOptions | MessageReplyOptions {
    return {
      // flags: message.ephemeral ? MessageFlags.Ephemeral : undefined,
      content: message.content,
      embeds: message.embeds?.map((embed) => ({
        ...embed,
        color: color(embed.color),
        image: typeof embed.image === 'string' ? { url: embed.image } : embed.image,
        thumbnail: typeof embed.thumbnail === 'string' ? { url: embed.thumbnail } : embed.thumbnail,
        footer: typeof embed.footer === 'string' ? { text: embed.footer } : embed.footer,
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
