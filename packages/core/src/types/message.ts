export interface FlarieIncomingMessage {
  guildId?: string;
  messageId: string;
  channelId: string;
  author: FlarieUser;
  content: string;

  typing(): Promise<void>;
  reply(message: string | FlarieOutgoingMessage): Promise<void>;
}

export type FlarieOutgoingMessage = {
  content?: string;
  embeds?: FlarieEmbed[];
  ephemeral?: boolean;
};

export type FlarieEmbed = {
  title?: string;
  color?: string;
  description?: string;
  url?: string;
  image?: FlarieEmbedMedia | string;
  thumbnail?: FlarieEmbedMedia | string;
  footer?:
    | {
        text: string;
        icon_url?: string;
      }
    | string;
  author?: string | FlarieEmbedAuthor;
  fields?: FlarieEmbedField[];
};

export type FlarieEmbedAuthor = {
  name: string;
  icon_url?: string;
  url?: string;
};

export type FlarieEmbedMedia = {
  url: string;
  width?: number;
  height?: number;
};

export type FlarieEmbedField = {
  name: string;
  value: string;
  inline?: boolean;
};

export type FlarieUser = {
  id: string;
  username: string;
  displayName: string | null;
  voiceChannelId?: string;
};

export enum MessageType {
  Reply,
  Forward,
}
