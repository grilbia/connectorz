import { pgTable, pgEnum, serial, text, varchar, timestamp } from "drizzle-orm/pg-core";

export const affinityEnum = pgEnum("affinity_type", ["lover", "bro", "bestie"]);
export const statusEnum = pgEnum("status", ["pending", "accepted", "declined"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  phoneNumber: varchar("phone_number", { length: 20 }).notNull().unique(),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const connections = pgTable("connections", {
  id: serial("id").primaryKey(),
  senderId: serial("sender_id").references(() => users.id),
  receiverId: serial("receiver_id").references(() => users.id),
  type: affinityEnum("type").notNull(),
  status: statusEnum("status").default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  connectionId: serial("connection_id").references(() => connections.id),
  senderId: serial("sender_id").references(() => users.id),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const buzzLogs = pgTable("buzz_logs", {
  id: serial("id").primaryKey(),
  senderId: serial("sender_id").references(() => users.id),
  receiverId: serial("receiver_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});