import { Flarie } from '@flarie/core';
import { config } from '../config';

export function addInfoCommand(flarie: Flarie) {
  const start = Date.now();

  flarie.register('info', async ({ bot, message }) => {
    await message.reply({
      embeds: [
        {
          title: 'Info',
          description: `Hey! <@${bot?.id}> here to deliver the news!`,
          fields: [
            {
              name: 'Version',
              value: config.short_version ?? 'Invalid Version',
              inline: true,
            },
            {
              name: 'Uptime',
              value: `<t:${Math.floor(start / 1000)}:R>`,
              inline: true,
            },
          ],
        },
      ],
    });
  });
}
