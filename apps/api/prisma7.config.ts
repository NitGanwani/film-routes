import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Named prisma7.config.ts so a future Prisma 8 upgrade does not clash with its
// own prisma.config.ts format. The Prisma 7 CLI picks this file up automatically.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
