import { eq } from 'drizzle-orm';
import { db, config_table } from '../db';

export async function getConfig(id?: string): Promise<typeof config_table.$inferSelect | undefined> {
  if (!id) return undefined;

  const [config] = await db.select().from(config_table).where(eq(config_table.guild_id, id)).limit(1);

  return (
    config ?? {
      guild_id: id,
      prefix: '!',
    }
  );
}

export async function hasConfig(id?: string): Promise<boolean> {
  if (!id) return false;

  const [config] = await db.select().from(config_table).where(eq(config_table.guild_id, id)).limit(1);

  return !!config;
}

export async function setConfig(config: typeof config_table.$inferSelect): Promise<void> {
  if (await hasConfig(config.guild_id)) {
    await db.update(config_table).set(config);
  } else {
    await db.insert(config_table).values(config);
  }
}
