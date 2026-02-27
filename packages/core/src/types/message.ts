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
  reference?: {
    type?: MessageType;
    guildId?: string;
    channelId?: string;
    messageId: string;
  };
  ephemeral?: boolean;
};

export type FlarieEmbed = {
  title?: string;
  color?: string;
  description?: string;
};

export type FlarieUser = {
  id: string;
  username: string;
  displayName: string | null;
};

export enum MessageType {
  Reply,
  Forward,
}
