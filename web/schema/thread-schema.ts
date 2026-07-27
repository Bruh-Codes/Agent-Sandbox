import { pgTable, text, timestamp, jsonb, index, json } from "drizzle-orm/pg-core";

export const threads = pgTable(
	"threads",
	{
		id: text("id").primaryKey(),
		userId: text("user_id").notNull(),
		title: text("title"),
		status: text("status", { enum: ["regular", "archived"] })
			.notNull()
			.default("regular"),
		custom: jsonb("custom").$type<Record<string, unknown>>(),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at").notNull().defaultNow(),
	},
	(t) => [index("threads_user_idx").on(t.userId)],
);

export const messages = pgTable(
	"messages",
	{
		id: text("id").primaryKey(),
		threadId: text("thread_id")
			.notNull()
			.references(() => threads.id, { onDelete: "cascade" }),
		parentId: text("parent_id"),
		format: text("format").notNull(),
		content: jsonb("content").notNull(),
		createdAt: timestamp("created_at").notNull().defaultNow(),
	},
	(t) => [index("messages_thread_idx").on(t.threadId)],
);

export const chatSessions = pgTable("chat_sessions", {
	id: text("id").primaryKey(),
	messages: json("messages").$type<Record<string, unknown>[]>().notNull(),
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
