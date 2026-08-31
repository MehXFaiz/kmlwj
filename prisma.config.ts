import dotenv from 'dotenv';
dotenv.config({ override: true });
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('MONGODB_URI'),
  },
});
