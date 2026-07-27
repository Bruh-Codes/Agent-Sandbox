import { auth } from "@/lib/auth";
import { extractText, toBackendHistory } from "@/lib/chat-utils";
import {
	createUIMessageStream,
	createUIMessageStreamResponse,
} from "ai";
import { headers } from "next/headers";

export const maxDuration = 30;

export async function POST(req: Request) {
	const { messages, model } = await req.json();
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session) return new Response("Unauthorized", { status: 401 });

	const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:8000";

	const lastUserMessage = messages.filter((m: any) => m.role === "user").at(-1);
	const userText = lastUserMessage ? extractText(lastUserMessage) : "";
	const history = toBackendHistory(messages, true);

	const stream = createUIMessageStream({
		originalMessages: messages,
		execute: async ({ writer }) => {
			const messageId = `msg-${crypto.randomUUID()}`;
			const textId = "resp-text";

			writer.write({ type: "start", messageId });
			writer.write({ type: "start-step" });
			writer.write({ type: "text-start", id: textId });

			try {
				const res = await fetch(`${backendUrl}/api/chat/stream`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						message: userText,
						session_id: null,
						history: history.length > 0 ? history : null,
						model: model || undefined,
					}),
				});

				if (!res.ok) {
					const errText = await res.text();
					writer.write({
						type: "text-delta",
						id: textId,
						delta: `[Backend error: ${res.status} — ${errText}]`,
					});
					writer.write({ type: "text-end", id: textId });
					writer.write({ type: "finish-step" });
					writer.write({ type: "finish" });
					return;
				}

				const reader = res.body?.getReader();
				if (!reader) {
					writer.write({ type: "text-delta", id: textId, delta: "[Empty response from backend]" });
					writer.write({ type: "text-end", id: textId });
					writer.write({ type: "finish-step" });
					writer.write({ type: "finish" });
					return;
				}

				const reasoningId = "resp-reasoning";
				let hasReasoning = false;
				const decoder = new TextDecoder();
				let buffer = "";

				while (true) {
					const { done, value } = await reader.read();
					if (done) break;
					buffer += decoder.decode(value, { stream: true });
					const lines = buffer.split("\n");
					buffer = lines.pop() || "";

					for (const line of lines) {
						if (!line.trim()) continue;
						try {
							const { type, content } = JSON.parse(line);
							if (type === "reasoning" && content) {
								if (!hasReasoning) {
									writer.write({ type: "reasoning-start", id: reasoningId });
									hasReasoning = true;
								}
								writer.write({ type: "reasoning-delta", id: reasoningId, delta: content });
							} else if (type === "text" && content) {
								writer.write({ type: "text-delta", id: textId, delta: content });
							} else if (type === "error") {
								writer.write({ type: "text-delta", id: textId, delta: `[FarmDesk error: ${content}]` });
							}
						} catch {
							if (line.trim()) {
								writer.write({ type: "text-delta", id: textId, delta: line });
							}
						}
					}
				}

				if (hasReasoning) {
					writer.write({ type: "reasoning-end", id: reasoningId });
				}
				writer.write({ type: "text-end", id: textId });
				writer.write({ type: "finish-step" });
				writer.write({ type: "finish" });
			} catch (e: any) {
				writer.write({
					type: "text-delta",
					id: textId,
					delta: `[FarmDesk backend unreachable: ${e?.message ?? e}]`,
				});
				writer.write({ type: "text-end", id: textId });
				writer.write({ type: "finish-step" });
				writer.write({ type: "finish" });
			}
		},
	});

	return createUIMessageStreamResponse({ stream });
}
