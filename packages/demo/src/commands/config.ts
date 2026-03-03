import { Flarie } from '@flarie/core';
import { getConfig, setConfig } from '../services/config';
import dedent from 'dedent';

export function addConfigCommands(flarie: Flarie) {
  flarie.register('config', async ({ message }) => {
    const config = await getConfig(message.guildId);

    if (!config) return;

    await message.reply({
      embeds: [
        {
          title: `Config`,
          description: dedent`
            **Guild ID:** ${config.guild_id}
            **Prefix:** ${config.prefix}
          `,
        },
      ],
      ephemeral: true,
    });
  });

  flarie.register('config set prefix {prefix}', async ({ message, args }) => {
    const config = await getConfig(message.guildId);

    if (!config || !args.prefix) return;

    await setConfig({
      ...config,
      prefix: args.prefix,
    });

    await message.reply(`Command prefix successfully updated to \`${args.prefix}\`!`);
  });
}
