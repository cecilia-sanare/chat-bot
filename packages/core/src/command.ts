import { toRegExp } from './utils/regex';
import type { FlariePlatform } from './platforms';

export class FlarieCommand {
  private expression: RegExp;
  constructor(
    command: string,
    private callback: FlarieCommand.Callback
  ) {
    this.expression = toRegExp(command);
  }

  async emit(details: FlariePlatform.MessageListenerDetails) {
    const result = this.expression.exec(details.message.content);

    if (!result) return;

    await this.callback({
      ...details,
      args: result?.groups ?? {},
    });
  }
}

export namespace FlarieCommand {
  export type Details = FlariePlatform.MessageListenerDetails & {
    args: Record<string, string>;
  };

  export type Callback = (details: Details) => void | Promise<void>;
}
