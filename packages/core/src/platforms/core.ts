import { ReadStream } from 'node:fs';
import type { FlarieIncomingMessage, FlarieOutgoingMessage, FlarieUser } from '../types/message';

export abstract class FlariePlatform {
  #status = FlariePlatform.Status.NOT_STARTED;
  #lastStatusChangeAt: number = Date.now();
  abstract name: string;

  private listeners: FlariePlatform.Listeners = {
    message: [],
    'audio:playing': [],
    'audio:resume': [],
    'audio:paused': [],
    'audio:idle': [],
  };

  async on<Event extends keyof FlariePlatform.Listeners>(
    event: Event,
    callback: FlariePlatform.Listeners[Event][number]
  ) {
    // TODO: Hate this, but can't for the life of me figure out how to get typescript to behave
    this.listeners[event].push(callback as any);
  }

  async off<Event extends keyof FlariePlatform.Listeners>(
    event: Event,
    callback: FlariePlatform.Listeners[Event][number]
  ) {
    const index = this.listeners[event].indexOf(callback as any);

    if (index === -1) return;

    this.listeners[event] = this.listeners[event].splice(index, 1) as any;
  }

  async emit<Event extends keyof FlariePlatform.Listeners>(
    event: Event,
    ...args: Parameters<FlariePlatform.Listeners[Event][number]>
  ) {
    const listeners = this.listeners[event];

    await Promise.all(listeners.map((listener) => (listener as any).call(undefined, ...args)));
  }

  get status() {
    return this.#status;
  }

  set status(status) {
    this.#status = status;
    this.#lastStatusChangeAt = Date.now();
  }

  get lastStatusChangeAt() {
    return this.#lastStatusChangeAt;
  }

  abstract send(id: string, message: FlarieOutgoingMessage | string): Promise<string>;
  abstract mention(id?: string): string | undefined;

  abstract connected(guildId: string): boolean;
  abstract join(channelId: string): Promise<void>;
  abstract leave(guildId: string): Promise<boolean>;
  abstract play(guildId: string, stream: ReadStream): Promise<void>;
  abstract stop(guildId: string): Promise<void>;
  abstract pause(guildId: string): Promise<void>;
  abstract unpause(guildId: string): Promise<void>;
  abstract playing(guildId: string): boolean;
}

export namespace FlariePlatform {
  export type Listeners = {
    message: MessageListener[];
    'audio:playing': PlayingListener[];
    'audio:resume': ResumeListener[];
    'audio:paused': PausedListener[];
    'audio:idle': IdleListener[];
  };

  export type MessageListener = (details: MessageListenerDetails) => void;
  export type MessageListenerDetails = {
    platform: FlariePlatform;
    message: FlarieIncomingMessage;
    bot?: FlarieUser;
  };

  export type PlayingListener = (details: PlayingListenerDetails) => void;
  export type PlayingListenerDetails = {
    guildId: string;
    channelId: string;
  };

  export type ResumeListener = (details: ResumeListenerDetails) => void;
  export type ResumeListenerDetails = {
    guildId: string;
    channelId: string;
  };

  export type PausedListener = (details: PausedListenerDetails) => void;
  export type PausedListenerDetails = {
    guildId: string;
    channelId: string;
  };

  export type IdleListener = (details: IdleListenerDetails) => void;
  export type IdleListenerDetails = {
    guildId: string;
    channelId: string;
  };

  export enum Status {
    /**
     * The platform hasn't even attempted to login yet.
     */
    NOT_STARTED,

    /**
     * The platform was disconnected.
     */
    DISCONNECTED,

    /**
     * The platform is connecting for the first time!
     */
    CONNECTING,

    /**
     * The platform is reconnecting
     */
    RECONNECTING,

    RESUMED,

    /**
     * The platform is connected
     */
    READY,
  }
}
