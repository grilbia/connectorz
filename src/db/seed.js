import { db } from "./db.js"; 
import { users, buzzLogs, connections } from "./schema.js";

async function seed() {
  console.log("🌱 Starting database seed...");

  try {
    // 1. Insert Users
    // We use .onConflictDoNothing() to avoid errors if you run this twice
    await db.insert(users).values([
      { id: 1, phoneNumber: "+959111111111", displayName: "Mg Mg" },
      { id: 2, phoneNumber: "+959222222222", displayName: "Su Su" },
      { id: 3, phoneNumber: "+959333333333", displayName: "Aung Aung" },
    ]).onConflictDoNothing();

    console.log("✅ Users seeded");

    // 2. Insert a Connection (Affinity)
    await db.insert(connections).values({
      senderId: 1,
      receiverId: 2,
      type: "bestie",
      status: "accepted",
    }).onConflictDoNothing();

     await db.insert(connections).values({
      senderId: 1,
      receiverId: 3,
      type: "bestie",
      status: "accepted",
    }).onConflictDoNothing();

    console.log("✅ Connections seeded");

    // 3. Insert some initial Buzz History
    await db.insert(buzzLogs).values([
      { senderId: 1, receiverId: 2 },
      { senderId: 3, receiverId: 2 },
    ]);

    console.log("✅ Buzz history seeded");
    console.log("🚀 Seed complete!");
    
  } catch (error) {
    console.error("❌ Seed failed:", error);
  } finally {
    process.exit(0);
  }
}

seed();