import { Tidal } from './tidal';

export class MusicManager {
  #current: Record<string, Tidal.Track> = {};
  #queues: Record<string, Tidal.Track[]> = {};

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

  queue(guildId: string, track: Tidal.Track) {
    this.lookup(guildId).push(track);
  }

  next(guildId?: string): Tidal.Track | null {
    if (!guildId) return null;

    const track = this.lookup(guildId).shift();

    if (!track) return null;

    this.#current[guildId] = track;
    return track;
  }
}

export namespace MusicManager {
  export type GuildTrack = {
    queue: Tidal.Track[];
  };
}
