import { Flarie, FlariePlatform, ShellPlatform } from '@flarie/core';
import { DiscordPlatform } from '@flarie/discord';
import { FluxerPlatform } from '@flarie/fluxer';
import { getConfig } from './services/config';
import { config, defined } from './config';
import { addConfigCommands } from './commands/config';
import { addArrCommands } from './commands/arr';

export function getPlatforms() {
  const platforms: FlariePlatform[] = [];

  if (config.environment === 'production') {
    if (defined.fluxer(config.fluxer)) {
      platforms.push(new FluxerPlatform(config.fluxer));
    }

    if (defined.discord(config.discord)) {
      platforms.push(new DiscordPlatform(config.discord));
    }

    if (platforms.length === 0) {
      console.error('Missing FLUXER_BOT_TOKEN or DISCORD_BOT_TOKEN environment variable.');
      process.exit(1);
    }
  } else {
    platforms.push(new ShellPlatform());
  }

  return platforms;
}

console.log(
  `\n[ChatBot]: Starting up! (${config.version === 'local' ? config.version : `https://github.com/cecilia-sanare/chat-bot/tree/${config.version}`})`
);

const flarie = new Flarie({
  platforms: getPlatforms(),
});

flarie.prefix(async (message) => {
  const config = await getConfig(message.guildId);

  return config?.prefix ?? '!';
});

// flarie.register('reactions new {title}', async ({ platform, message, args }) => {
//   if (!args.title) return;

//   const id = await platform.send(message.channelId, {
//     embeds: [
//       {
//         title: args.title,
//       },
//     ],
//   });

//   await createReactionRoles({
//     message_id: id,
//   });
// });

// flarie.register('reactions add {role} {emoji}', async ({ platform, message, args }) => {
//   console.log('reactions');
//   if (!args.role || !args.emoji) return;

//   console.log(message, args.role, args.emoji);
//   // const id = await platform.send(message.channelId, {
//   //   embeds: [
//   //     {
//   //       title: args.title,
//   //     },
//   //   ],
//   // });

//   // await createReactionRoles({
//   //   message_id: id,
//   // });
// });

addConfigCommands(flarie);
addArrCommands(flarie);
