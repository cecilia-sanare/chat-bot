import { Flarie, FlariePlatform } from '@flarie/core';
import { config } from '../config';
import { EMPTY_SPACE } from '../constants/characters';
import { dbStatus } from '../db';

const STATUS_TO_LABEL: Record<FlariePlatform.Status, string> = {
  [FlariePlatform.Status.NOT_STARTED]: '🔴 Not Started',
  [FlariePlatform.Status.DISCONNECTED]: '🔴 Disconnected',
  [FlariePlatform.Status.CONNECTING]: '🔴 Connecting',
  [FlariePlatform.Status.RECONNECTING]: '🔴 Reconnecting',
  [FlariePlatform.Status.READY]: '🟢 Online',
  [FlariePlatform.Status.RESUMED]: '🟢 Online',
};

export function addStatusCommands(flarie: Flarie) {
  const start = Date.now();

  flarie.register('status', async ({ bot, message }) => {
    await message.typing();

    const status = await dbStatus();

    await message.reply({
      embeds: [
        {
          title: `ChatBot v${config.version}`,
          description: `Hey! <@${bot?.id}> here with a status report!`,
          fields: [
            ...flarie.platforms
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((platform) => [
                {
                  name: `${platform.name} Bot`,
                  value: STATUS_TO_LABEL[platform.status],
                  inline: true,
                },
                {
                  name: 'Since',
                  value: platform.lastStatusChangeAt
                    ? `<t:${Math.floor(platform.lastStatusChangeAt / 1000)}:R>`
                    : '_Unknown_',
                  inline: true,
                },
                {
                  name: EMPTY_SPACE,
                  value: EMPTY_SPACE,
                  inline: true,
                },
              ])
              .flat(),
            {
              name: 'Database',
              value: status ? '🟢 Online' : '🔴 Offline',
              inline: true,
            },
            {
              name: 'Since',
              value: `<t:${Math.floor(start / 1000)}:R>`,
              inline: true,
            },
            {
              name: EMPTY_SPACE,
              value: EMPTY_SPACE,
              inline: true,
            },
            {
              name: 'Backend',
              value: '🟢 Online',
              inline: true,
            },
            {
              name: 'Since',
              value: `<t:${Math.floor(start / 1000)}:R>`,
              inline: true,
            },
            {
              name: EMPTY_SPACE,
              value: EMPTY_SPACE,
              inline: true,
            },
          ],
        },
      ],
    });
  });
}
