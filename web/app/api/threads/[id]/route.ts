export const dynamic = "force-dynamic";

import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import db from "@/lib/db";
import { threads } from "@/schema/thread-schema";

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

  return Response.json(thread);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  const patch = (await req.json()) as { title?: string; status?: "regular" | "archived" };
  await db
    .update(threads)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(threads.id, id), eq(threads.userId, session.user.id)));

  return new Response(null, { status: 204 });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });

  await db
    .delete(threads)
    .where(and(eq(threads.id, id), eq(threads.userId, session.user.id)));

  return new Response(null, { status: 204 });
}
