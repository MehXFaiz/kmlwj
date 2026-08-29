import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

const rootDir = process.cwd();
const schemaPrismaPath = path.join(rootDir, 'prisma', 'schema.prisma');
const schemaPgPath = path.join(rootDir, 'prisma', 'schema.postgresql.prisma');
const schemaMyPath = path.join(rootDir, 'prisma', 'schema.mysql.prisma');

const dbUrl = process.env.DATABASE_URL || process.env.DIRECT_URL || '';
const dbHost = process.env.DB_HOST || '';
const isExplicitMySQL = dbUrl.startsWith('mysql://') || (Boolean(dbHost) && !dbUrl.startsWith('postgres'));

const targetSource = isExplicitMySQL ? schemaMyPath : schemaPgPath;
const targetDialect = isExplicitMySQL ? 'MySQL' : 'PostgreSQL';

try {
  if (fs.existsSync(targetSource)) {
    const targetContent = fs.readFileSync(targetSource, 'utf8');
    fs.writeFileSync(schemaPrismaPath, targetContent, 'utf8');
    console.log(`[prepare-prisma] Target database dialect configured: ${targetDialect}`);
  } else {
    console.warn(`[prepare-prisma] Warning: Source schema template ${targetSource} not found, keeping existing schema.prisma`);
  }
} catch (err) {
  console.error('[prepare-prisma] Failed to prepare schema.prisma:', err);
}
