export const dynamic = "force-dynamic";

import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import db from "@/lib/db";
import { threads } from "@/schema/thread-schema";
import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";

export async function POST(
  req: Request,
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

  let title = "Chat";

  try {
    const { messages } = (await req.json()) as { messages: any[] };

    function extractText(m: any): string {
      const parts = m.parts ?? m.content;
      if (Array.isArray(parts)) {
        return parts
          .filter((p: any) => p.type === "text")
          .map((p: any) => p.text)
          .filter(Boolean)
          .join(" ");
      }
      if (typeof m.content === "string") return m.content;
      return "";
    }

    const result = streamText({
      model: openai("gpt-4.1-mini"),
      system:
        "You are a helpful assistant that generates a short, concise title (max 6 words) for a conversation. Return only the title, no quotes or extra text.",
      messages: messages.slice(0, 2).map((m: any) => ({
        role: m.role,
        content: extractText(m),
      })),
    });

    title = "";
    for await (const chunk of result.textStream) {
      title += chunk;
    }

    title = title.trim().replace(/^["']|["']$/g, "");
  } catch {
    title = "Chat";
  }

  await db
    .update(threads)
    .set({ title, updatedAt: new Date() })
    .where(eq(threads.id, id));

  return Response.json({ title });
}
