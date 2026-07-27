export const dynamic = "force-dynamic";

import { headers } from "next/headers";
import { and, asc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import db from "@/lib/db";
import { threads, messages } from "@/schema/thread-schema";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const [thread] = await db
    .select()
    .from(threads)
    .where(and(eq(threads.id, id), eq(threads.userId, session.user.id)));
  if (!thread) return new Response(null, { status: 404 });

  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.threadId, id))
    .orderBy(asc(messages.createdAt));

  return Response.json(rows);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    id: string;
    parent_id: string | null;
    format: string;
    content: Record<string, unknown>;
  };

  await db.insert(messages).values({
    id: body.id,
    threadId: id,
    parentId: body.parent_id,
    format: body.format,
    content: body.content,
  });

  return new Response(null, { status: 204 });
}
