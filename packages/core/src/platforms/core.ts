import type { FlarieIncomingMessage, FlarieOutgoingMessage, FlarieUser } from '../types/message';

export abstract class FlariePlatform {
  private listeners: FlariePlatform.Listeners = {
    message: [],
  };

  async on<Event extends FlariePlatform.ListenerEvents>(
    event: Event,
    callback: FlariePlatform.Listeners[Event][number]
  ) {
    this.listeners[event].push(callback);
  }

  async off<Event extends FlariePlatform.ListenerEvents>(
    event: Event,
    callback: FlariePlatform.Listeners[Event][number]
  ) {
    const index = this.listeners[event].indexOf(callback);

    if (index === -1) return;

    this.listeners[event] = this.listeners[event].splice(index, 1);
  }

  async emit<Event extends FlariePlatform.ListenerEvents>(
    event: Event,
    ...args: Parameters<FlariePlatform.Listeners[Event][number]>
  ) {
    const listeners = this.listeners[event];

    await Promise.all(listeners.map((listener) => listener.call(undefined, ...args)));
  }

  abstract send(id: string, message: FlarieOutgoingMessage): Promise<string>;
  abstract mention(id?: string): string | undefined;
}

export namespace FlariePlatform {
  export type Listeners = {
    message: MessageListener[];
  };

  export type ListenerEvents = keyof Listeners;

  export type MessageListener = (details: MessageListenerDetails) => void;
  export type MessageListenerDetails = {
    platform: FlariePlatform;
    message: FlarieIncomingMessage;
    bot?: FlarieUser;
  };
}
