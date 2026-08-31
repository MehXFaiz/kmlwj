/**
 * Check HallBooking documents in MongoDB
 */

import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

async function checkHallBooking() {
  const client = new MongoClient(process.env.MONGODB_URI!);
  try {
    await client.connect();
    const db = client.db('kmlwj');
    const collection = db.collection('HallBooking');

    const count = await collection.countDocuments();
    console.log(`Total HallBooking documents: ${count}\n`);

    const docs = await collection.find({}).toArray();
    for (let i = 0; i < Math.min(docs.length, 5); i++) {
      console.log(`Document ${i + 1}:`);
      console.log(`  _id: ${docs[i]._id}`);
      console.log(`  id: ${docs[i].id}`);
      console.log(`  bookerName: ${docs[i].bookerName}`);
      console.log('');
    }

    if (docs.length > 5) {
      console.log(`... and ${docs.length - 5} more documents`);
    }
  } finally {
    await client.close();
  }
}

checkHallBooking().catch(console.error);
