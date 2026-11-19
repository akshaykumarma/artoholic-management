// Drizzle Kit (optional, not installed by default) is only for introspection/studio;
// migrations are hand-written SQL in db/migrations, applied by db/migrate.ts.
const config = { schema: './db/schema.ts', dialect: 'postgresql', dbCredentials: { url: process.env.DATABASE_URL ?? '' } };
export default config;
