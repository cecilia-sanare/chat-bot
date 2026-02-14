import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const config_table = sqliteTable('config', {
  guild_id: text().primaryKey(),
  prefix: text().default('!').notNull(),
});

export const reaction_roles_table = sqliteTable('reaction_roles', {
  message_id: text().primaryKey(),
});
