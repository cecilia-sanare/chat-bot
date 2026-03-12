import { toRegExpFunction, type RegExpFunction } from './utils/regex';
import type { FlariePlatform } from './platforms';

export class FlarieCommand {
  private exec: RegExpFunction;
  constructor(
    commands: string | string[],
    private callback: FlarieCommand.Callback
  ) {
    this.exec = toRegExpFunction(commands);
  }

  async emit(details: FlariePlatform.MessageListenerDetails): Promise<boolean> {
    const [matches, groups] = this.exec(details.message.content);

    if (!matches) return false;

    await this.callback({
      ...details,
      args: groups,
    });

    return true;
  }
}

export namespace FlarieCommand {
  export type Details = FlariePlatform.MessageListenerDetails & {
    args: Record<string, string>;
  };

  export type Callback = (details: Details) => void | Promise<void>;
}
