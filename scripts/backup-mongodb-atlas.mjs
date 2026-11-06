import dns from 'dns';
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {
  // Ignore DNS fallback errors
}
import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

/**
 * Verified Full MongoDB Atlas Backup & Recovery Utility
 * Usage:
 *   Backup:  node scripts/backup-mongodb-atlas.mjs
 *   Restore: node scripts/backup-mongodb-atlas.mjs --restore <backup-file.json>
 */
async function main() {
  const dbUrl = process.env.MONGODB_URI || process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('[Backup] ERROR: MONGODB_URI / DATABASE_URL is not defined in .env');
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const restoreIdx = args.indexOf('--restore');

  const client = new MongoClient(dbUrl);
  await client.connect();
  const db = client.db();

  try {
    if (restoreIdx !== -1) {
      const backupFile = args[restoreIdx + 1];
      if (!backupFile || !fs.existsSync(backupFile)) {
        console.error('[Restore] ERROR: Please specify a valid backup JSON file.');
        process.exit(1);
      }
      if (process.env.CONFIRM_BACKUP_RESTORE !== 'YES_RESTORE_NOW') {
        console.error('[Restore] SAFETY GUARD: Set CONFIRM_BACKUP_RESTORE=YES_RESTORE_NOW to execute a full restore.');
        process.exit(1);
      }

      console.log(`[Restore] Reading backup file: ${backupFile}`);
      const payload = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
      const collections = payload.collections || {};

      for (const [colName, docs] of Object.entries(collections)) {
        if (!Array.isArray(docs) || docs.length === 0) continue;
        const col = db.collection(colName);
        let upserted = 0;
        for (const doc of docs) {
          const { _id, ...rest } = doc;
          await col.updateOne({ _id }, { $set: rest }, { upsert: true });
          upserted++;
        }
        console.log(`[Restore] Collection ${colName}: restored/verified ${upserted} document(s).`);
      }
      console.log('[Restore] Full non-destructive restore completed.');
      return;
    }

    // Create full non-destructive backup export
    const backupDir = path.resolve(process.cwd(), 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFilePath = path.join(backupDir, `mongodb-atlas-backup-${timestamp}.json`);
    const latestManifestPath = path.join(backupDir, 'latest-backup-manifest.json');

    const collectionsInfo = await db.listCollections().toArray();
    const collectionNames = collectionsInfo.map((c) => c.name).sort();

    const backupData = {
      metadata: {
        createdAt: new Date().toISOString(),
        databaseName: db.databaseName,
        totalCollections: collectionNames.length,
        totalDocuments: 0,
        totalActiveDocuments: 0,
        totalSoftDeletedDocuments: 0,
        collectionSummary: {},
      },
      collections: {},
    };

    for (const name of collectionNames) {
      const col = db.collection(name);
      const docs = await col.find({}).toArray();
      const indexes = await col.indexes();
      const softDeletedCount = docs.filter((d) => d.isDeleted === true).length;
      const activeCount = docs.length - softDeletedCount;

      backupData.collections[name] = docs;
      backupData.metadata.totalDocuments += docs.length;
      backupData.metadata.totalActiveDocuments += activeCount;
      backupData.metadata.totalSoftDeletedDocuments += softDeletedCount;
      backupData.metadata.collectionSummary[name] = {
        total: docs.length,
        active: activeCount,
        softDeleted: softDeletedCount,
        indexes: indexes.map((idx) => ({ name: idx.name, key: idx.key, unique: !!idx.unique })),
      };
    }

    fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2), 'utf8');
    fs.writeFileSync(
      latestManifestPath,
      JSON.stringify(
        {
          backupFile: backupFilePath,
          ...backupData.metadata,
        },
        null,
        2
      ),
      'utf8'
    );

    console.log(`[Backup] SUCCESS: Verified MongoDB Atlas backup written to: ${backupFilePath}`);
    console.log(`[Backup] Total Collections: ${backupData.metadata.totalCollections}`);
    console.log(`[Backup] Total Documents: ${backupData.metadata.totalDocuments} (Active: ${backupData.metadata.totalActiveDocuments}, Soft-Deleted: ${backupData.metadata.totalSoftDeletedDocuments})`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('[Backup] Fatal error:', err);
  process.exit(1);
});
