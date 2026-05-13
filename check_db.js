import { db } from './src/db/db.js';
import { users } from './src/db/schema.js';

async function check() {
  try {
    const result = await db.select().from(users);
    console.log('Users found:', result.length);
    console.log(result);
  } catch (e) {
    console.error('Error:', e);
  } finally {
    process.exit(0);
  }
}

check();
