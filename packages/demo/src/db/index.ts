import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { config } from '../config';

const client = createClient({ url: config.db });
export const db = drizzle({ client });

export async function dbStatus(): Promise<boolean> {
  try {
    await db.$client.execute('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

export * from './schema';
