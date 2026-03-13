import { Tidal } from './tidal';

export class MusicManager {
  #current: Record<string, Tidal.Track> = {};
  #queues: Record<string, Tidal.Track[]> = {};
  #listeners: MusicManager.Listeners = {
    fresh: [],
  };

  lookup(guildId: string): Tidal.Track[];
  lookup(guildId?: string): Tidal.Track[] | null;
  lookup(guildId?: string): Tidal.Track[] | null {
    if (!guildId) return null;

    let queue = this.#queues[guildId];

    if (!queue) {
      queue = [];
      this.#queues[guildId] = queue;
    }

    return queue;
  }

  current(guildId?: string): Tidal.Track | null {
    if (!guildId) return null;

    return this.#current[guildId] ?? null;
  }

  queue(guildId: string, ...tracks: Tidal.Track[]) {
    const queue = this.lookup(guildId);

    const [track] = tracks;

    // If there are no items in the queue, something is playing, and we were provided tracks
    // Then emit an event so we can pre-download the next track
    if (queue.length === 0 && this.current(guildId) && track) {
      this.#emit('fresh', { guildId, track });
    }

    queue.push(...tracks);
  }

  /**
   * Set the next track as the active one and remove it from the queue.
   */
  next(guildId?: string): Tidal.Track | null {
    if (!guildId) return null;

    const track = this.lookup(guildId).shift();

    if (!track) return null;

    this.#current[guildId] = track;
    return track;
  }

  /**
   * View the next track without making it the current track or modifying the queue.
   */
  peek(guildId?: string): Tidal.Track | null {
    if (!guildId) return null;

    const [track] = this.lookup(guildId);

    if (!track) return null;

    return track;
  }

  clear(guildId?: string) {
    if (!guildId) return;

    delete this.#current[guildId];
  }

  on<E extends keyof MusicManager.Listeners>(event: E, listener: MusicManager.Listeners[E][number]): void {
    this.#listeners[event].push(listener);
  }

  async off<E extends keyof MusicManager.Listeners>(event: E, callback: MusicManager.Listeners[E][number]) {
    const index = this.#listeners[event].indexOf(callback as any);

    if (index === -1) return;

    this.#listeners[event] = this.#listeners[event].splice(index, 1) as any;
  }

  async #emit<E extends keyof MusicManager.Listeners>(
    event: E,
    ...args: Parameters<MusicManager.Listeners[E][number]>
  ): Promise<void> {
    const listeners = this.#listeners[event];

    await Promise.all(listeners.map((listener) => listener.call(undefined, ...args)));
  }
}

export namespace MusicManager {
  export type GuildTrack = {
    queue: Tidal.Track[];
  };

  export type Listeners = {
    fresh: FreshListener[];
  };

  export type FreshListener = (details: FreshListenerDetails) => void;
  export type FreshListenerDetails = { guildId: string; track: Tidal.Track };
}
