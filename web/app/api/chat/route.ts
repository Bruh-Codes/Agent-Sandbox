import { auth } from "@/lib/auth";
import {
	createUIMessageStream,
	createUIMessageStreamResponse,
} from "ai";
import { headers } from "next/headers";

export const maxDuration = 30;

function extractText(msg: any): string {
	if (typeof msg.content === "string") return msg.content;
	if (Array.isArray(msg.content)) {
		const parts = msg.content
			.filter((p: any) => p.type === "text")
			.map((p: any) => p.text)
			.filter(Boolean);
		if (parts.length > 0) return parts.join("\n");
		const allText = msg.content.map((p: any) => p.text ?? "").join("");
		if (allText) return allText;
	}
	if (msg.text) return msg.text;
	return "";
}

function toBackendHistory(messages: any[], excludeLastUser: boolean): { role: string; content: string }[] {
	const msgs = excludeLastUser ? messages.slice(0, -1) : messages;
	return msgs
		.filter((m: any) => m.role === "user" || m.role === "assistant")
		.map((m: any) => ({
			role: m.role,
			content: extractText(m),
		}))
		.filter((m) => m.content.trim());
}

export async function POST(req: Request) {
	const { messages } = await req.json();
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

				const decoder = new TextDecoder();
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;
					const chunk = decoder.decode(value, { stream: true });
					if (chunk) {
						writer.write({ type: "text-delta", id: textId, delta: chunk });
					}
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
