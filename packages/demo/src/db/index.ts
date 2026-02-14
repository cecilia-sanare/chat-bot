import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { config } from '../config';

const client = createClient({ url: config.db });
export const db = drizzle({ client });

export * from './schema';
