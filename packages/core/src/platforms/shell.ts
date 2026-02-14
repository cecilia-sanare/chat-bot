import { userInfo } from 'node:os';
import * as readline from 'node:readline/promises';
import chalk from 'chalk';
import { FlariePlatform } from './core';
import { MessageType, type FlarieOutgoingMessage, type FlarieUser } from '../types/message';

const { cyan, magenta, bold, italic } = chalk;

export class ShellPlatform extends FlariePlatform {
  static #BOT: FlarieUser = {
    id: '0',
    displayName: 'Flarie',
    username: 'flarie',
  };

  static #USER = userInfo().username;

  #messageId: number;
  #rl: readline.Interface;

  constructor() {
    super();

    this.#messageId = 0;

    this.#rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log('[Shell] Connecting...');
    setTimeout(async () => {
      console.log(`[Shell] Logged in as ${ShellPlatform.#BOT.displayName}!`);

      while (true) {
        const message = await this.#rl.question('> ');

        process.stdout.clearLine(0);
        process.stdout.moveCursor(0, -1);
        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);

        if (['exit', 'quit'].includes(message)) {
          process.exit(0);
        } else {
          console.log(`[${ShellPlatform.#USER}]: ${message}`);

          await this.emit('message', {
            platform: this,
            message: {
              guildId: '0',
              messageId: String(this.#messageId++),
              author: {
                id: '1',
                displayName: ShellPlatform.#USER,
                username: ShellPlatform.#USER,
              },
              channelId: '0',
              content: message,

              reply: async (message) => {
                const flarieMessage: FlarieOutgoingMessage =
                  typeof message === 'string'
                    ? {
                        content: message,
                        reference: {
                          type: MessageType.Reply,
                          guildId: '0',
                          channelId: '0',
                          messageId: String(this.#messageId++),
                        },
                      }
                    : message;

                this.#log(ShellPlatform.#BOT.displayName!, flarieMessage);
              },
            },
            bot: ShellPlatform.#BOT,
          });
        }
      }
    }, 500);
  }
  override async send(id: string, message: FlarieOutgoingMessage): Promise<string> {
    this.#log(ShellPlatform.#BOT.displayName!, message);

    return String(this.#messageId++);
  }

  override mention(id?: string): string | undefined {
    if (!id) return undefined;

    return `<@${id}>`;
  }

  #log(name: string, message: FlarieOutgoingMessage) {
    if (message.ephemeral) {
      console.log(magenta(italic(`[${name}][e]: ${message.content}`)));
    } else {
      console.log(cyan(`${bold(`[${name}]:`)} ${message.content}`));
    }
  }
}
