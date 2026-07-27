export const dynamic = "force-dynamic";

import { headers } from "next/headers";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import db from "@/lib/db";
import { threads } from "@/schema/thread-schema";
import { generateId } from "ai";

export async function GET() {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

	const rows = await db
		.select()
		.from(threads)
		.where(eq(threads.userId, session.user.id))
		.orderBy(desc(threads.updatedAt));

	return Response.json(rows);
}

export async function POST() {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

	const id = generateId();
	await db.insert(threads).values({ id, userId: session.user.id });
	return Response.json({ id });
}
