import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'npx tsx prisma/seed.ts', // Prisma 7 seeds are configured here
  },
  datasource: {
    url: env('DIRECT_URL'), // Prisma CLI uses this direct connection for migrations and seeding
  },
});
