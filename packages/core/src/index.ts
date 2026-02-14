import type { FlariePlatform } from './platforms/core';
import { FlarieCommand } from './command';
import type { FlarieIncomingMessage } from './types/message';

export class Flarie {
  #platforms: FlariePlatform[];
  #options: Omit<Flarie.Options, 'platforms'>;
  #commands: FlarieCommand[] = [];
  #prefix: Flarie.Prefix = '!';

  constructor({ platforms, ...options }: Flarie.Options) {
    this.#options = options;
    this.#platforms = platforms;

    for (const platform of this.#platforms) {
      platform.on('message', async (details) => {
        const processed_details = await this.process(details);

        if (!processed_details) return;

        for (const command of this.#commands) {
          await command.emit(processed_details);
        }
      });
    }
  }

  register(command: string, callback: FlarieCommand.Callback): void {
    this.#commands.push(new FlarieCommand(command, callback));
  }

  prefix(prefix: Flarie.Prefix): void {
    this.#prefix = prefix;
  }

  /**
   * Verifies the message is intended for us and processes it
   */
  private async process(
    details: FlariePlatform.MessageListenerDetails
  ): Promise<FlariePlatform.MessageListenerDetails | false> {
    const prefix = typeof this.#prefix === 'function' ? await this.#prefix(details.message) : this.#prefix;
    const mention = details.platform.mention(details.bot?.id);

    if (details.message.content.startsWith(prefix)) {
      details.message.content = details.message.content.substring(1);
      return details;
    } else if (mention && details.message.content.startsWith(mention)) {
      details.message.content = details.message.content.substring(mention.length).trim();
      return details;
    }

    return false;
  }
}

export namespace Flarie {
  export type Options = {
    platforms: FlariePlatform[];
  };

  export type Prefix = string | ((message: FlarieIncomingMessage) => Promise<string>);
}

export * from './platforms';
export * from './types';
export * from './utils';
