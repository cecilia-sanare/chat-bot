import { defineConfig } from 'drizzle-kit';

const url = process.env.DB_URL;

if (!url) {
  console.error('Missing DB_URL environment variable.');
  process.exit(1);
}

export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema.ts',
  dialect: 'sqlite',
  dbCredentials: {
    url,
  },
});
