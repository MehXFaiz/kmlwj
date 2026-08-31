import fs from 'fs';
import path from 'path';

const schemaPath = path.resolve('prisma/schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf-8');

// 1. Replace @default(auto()) @map("_id") @db.ObjectId with @default(uuid()) @map("_id")
schema = schema.replace(/@default\(auto\(\)\)\s+@map\("_id"\)\s+@db\.ObjectId/g, '@default(uuid()) @map("_id")');

// 2. Remove any remaining @db.ObjectId
schema = schema.replace(/\s+@db\.ObjectId/g, '');

fs.writeFileSync(schemaPath, schema, 'utf-8');
console.log('Successfully transformed schema.prisma to UUID string relations.');
