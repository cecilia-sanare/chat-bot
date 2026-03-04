import { Flarie } from '@flarie/core';
import dedent from 'dedent';

export function addUptimeCommand(flarie: Flarie) {
  const start = Date.now();

  flarie.register('uptime', async ({ message }) => {
    await message.reply({
      embeds: [
        {
          title: 'Uptime',
          description: dedent`
            **Initialized:** <t:${Math.floor(start / 1000)}:R>
          `,
        },
      ],
    });
  });
}
