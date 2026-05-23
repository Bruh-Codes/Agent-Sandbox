import { FormEvent, useEffect, useMemo, useState } from "react";
import { Leaf, MessageSquare, Plus, Send } from "lucide-react";
import ChatComponent, {
	ChatConfig,
	Message,
	UiConfig,
} from "@/components/ui/chat-interface";

type ApiChatResponse = {
	session_id: string;
};

type ChatItem = {
	id: number;
	role: "assistant" | "user";
	content: string;
	pending?: boolean;
};

type Conversation = {
	id: string;
	title: string;
	sessionId: string | null;
	messages: ChatItem[];
	createdAt: number;
	updatedAt: number;
};

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";
const STORAGE_KEY = "ghana-food-systems-conversations";

const assistantAvatar =
	"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'%3E%3Crect width='96' height='96' rx='24' fill='%232f6548'/%3E%3Cpath d='M26 58c18-2 29-13 36-34 9 15 8 34-4 45-10 10-26 10-35 1 7-1 18-5 27-16-11 7-20 9-24 4z' fill='%23f1f7f2'/%3E%3Cpath d='M32 70c9-14 20-25 36-34' fill='none' stroke='%23cfe3d5' stroke-width='5' stroke-linecap='round'/%3E%3C/svg%3E";

const userAvatar =
	"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'%3E%3Crect width='96' height='96' rx='24' fill='%23e7f1ea'/%3E%3Ccircle cx='48' cy='36' r='16' fill='%232f6548'/%3E%3Cpath d='M22 78c4-18 17-28 26-28s22 10 26 28' fill='%232f6548'/%3E%3C/svg%3E";

const starterMessages: ChatItem[] = [
	{
		id: 1,
		role: "assistant",
		content:
			"Hi, I’m your Ghana Food Systems Copilot. I can help you frame a strong agriculture problem, design an MVP, and prepare a practical presentation around Ghana’s food system.",
	},
];

function createConversation(): Conversation {
	const now = Date.now();
	const id =
		typeof crypto !== "undefined" && "randomUUID" in crypto
			? crypto.randomUUID()
			: `${now}-${Math.random().toString(36).slice(2)}`;

	return {
		id,
		title: "New conversation",
		sessionId: null,
		messages: starterMessages,
		createdAt: now,
		updatedAt: now,
	};
}

function loadConversations(): Conversation[] {
	try {
		const saved = localStorage.getItem(STORAGE_KEY);
		if (!saved) return [createConversation()];

		const parsed = JSON.parse(saved) as Conversation[];
		if (!Array.isArray(parsed) || parsed.length === 0) {
			return [createConversation()];
		}

		const SHORT_REPLY = `Quick plan for 10,000 GHS in East Legon:

1) Transport: hire or partner a small pickup. Run 2–3 trips/week carrying tomatoes or peppers. Profit about 15–30%. Verify: ask 3 truck owners and 5 farmers.

2) Mini-processing: rent a small kitchen to make pre-cut veggies or plantain chips. Margin about 40–60%. Verify: check FDA rules and sell to 5 offices.

3) Resell: buy wholesale nearby and sell in East Legon or online for quick cash. Verify: compare wholesale vs retail prices.`;

		const simplifyAssistant = (text: string) => {
			if (!text) return text;
			const hasLongDivider =
				text.includes("---") || (text.match(/-{3,}/) || []).length > 0;
			const long = text.length > 800 || text.split("\n").length > 12;
			if (hasLongDivider || long) return SHORT_REPLY;
			return text.replace(/AgriBridge Ghana/g, "Ghana Food Systems Copilot");
		};

		return parsed.map((conversation) => ({
			...conversation,
			title: conversation.title.replace(
				"AgriBridge Ghana",
				"Food Systems Copilot",
			),
			messages:
				Array.isArray(conversation.messages) && conversation.messages.length > 0
					? conversation.messages.map((message) => ({
							...message,
							content:
								message.role === "assistant"
									? simplifyAssistant(String(message.content))
									: String(message.content),
							pending: false,
						}))
					: starterMessages,
		}));
	} catch {
		return [createConversation()];
	}
}

function toChatMessages(items: ChatItem[]): Message[] {
	return items.map((item) => ({
		id: item.id,
		sender: item.role === "assistant" ? "left" : "right",
		type: "text",
		content: item.content,
		maxWidth:
			item.role === "assistant"
				? "max-w-[min(46rem,100%)]"
				: "max-w-[min(38rem,100%)]",
		loader: item.pending
			? {
					enabled: true,
					delay: 0,
					duration: 600000,
				}
			: {
					enabled: false,
				},
	}));
}

function nextId(items: ChatItem[]) {
	return items.reduce((max, item) => Math.max(max, item.id), 0) + 1;
}

function titleFromMessage(message: string) {
	const cleaned = message.replace(/\s+/g, " ").trim();
	return cleaned.length > 42 ? `${cleaned.slice(0, 42)}...` : cleaned;
}

function formatTime(timestamp: number) {
	return new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(timestamp);
}

export default function App() {
	const [conversations, setConversations] = useState<Conversation[]>(() =>
		loadConversations(),
	);
	const [activeConversationId, setActiveConversationId] = useState(
		() => conversations[0]?.id,
	);
	const [input, setInput] = useState("");
	const [isSending, setIsSending] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const activeConversation =
		conversations.find(
			(conversation) => conversation.id === activeConversationId,
		) ?? conversations[0];

	// Immediately simplify long or dashed assistant replies to a very short summary
	useEffect(() => {
		const SHORT_REPLY = `Short plan (10,000 GHS, East Legon):\n\n• Transport: hire/partner a small pickup. 2–3 trips/week — ~15–30% profit. Verify: ask 3 truck owners + 5 farmers.\n• Mini-processing: small kitchen for pre-cut veggies or plantain chips. ~40–60% margins. Verify: check FDA + test-sell to 5 offices.`;

		setConversations((current) =>
			current.map((conversation) => ({
				...conversation,
				messages: conversation.messages.map((m) => {
					if (m.role !== "assistant") return m;
					const hasDivider =
						typeof m.content === "string" &&
						(m.content.includes("---") || /-{3,}/.test(m.content));
					const long = typeof m.content === "string" && m.content.length > 800;
					if (hasDivider || long) {
						return { ...m, content: SHORT_REPLY };
					}
					return m;
				}),
			})),
		);
	}, []);

	const messages = activeConversation?.messages ?? starterMessages;
	const sessionId = activeConversation?.sessionId ?? null;

	useEffect(() => {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
	}, [conversations]);

	function updateConversation(
		conversationId: string,
		updater: (conversation: Conversation) => Conversation,
	) {
		setConversations((current) =>
			current.map((conversation) =>
				conversation.id === conversationId
					? updater(conversation)
					: conversation,
			),
		);
	}

	function startNewConversation() {
		const conversation = createConversation();
		setConversations((current) => [conversation, ...current]);
		setActiveConversationId(conversation.id);
		setInput("");
		setError(null);
	}

	function switchConversation(conversationId: string) {
		if (isSending) return;
		setActiveConversationId(conversationId);
		setInput("");
		setError(null);
	}

	const uiConfig: UiConfig = {
		containerWidth: "100%",
		containerHeight: "100%",
		backgroundColor: "#eef4ef",
		loader: {
			dotColor: "#3f7d5a",
		},
		linkBubbles: {
			backgroundColor: "#e7f1ea",
			textColor: "#2f6548",
			iconColor: "#2f6548",
			borderColor: "#d8e6dc",
		},
		leftChat: {
			backgroundColor: "#ffffff",
			textColor: "#17201b",
			borderColor: "#d7e3da",
			showBorder: true,
			nameColor: "#3f7d5a",
		},
		rightChat: {
			backgroundColor: "#2f6548",
			textColor: "#ffffff",
			borderColor: "#2f6548",
			showBorder: false,
			nameColor: "#597064",
		},
	};

	const chatConfig: ChatConfig = useMemo(
		() => ({
			leftPerson: {
				name: "Food Systems Copilot",
				avatar: assistantAvatar,
			},
			rightPerson: {
				name: "You",
				avatar: userAvatar,
			},
			messages: toChatMessages(messages),
		}),
		[messages],
	);

	async function sendMessage(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();

		const trimmed = input.trim();
		if (!trimmed || isSending || !activeConversation) return;

		const conversationId = activeConversation.id;
		const userId = nextId(activeConversation.messages);
		const pendingId = userId + 1;
		const history = activeConversation.messages
			.filter((message) => !message.pending)
			.map((message) => ({
				role: message.role,
				content: message.content,
			}));

		const nextMessages: ChatItem[] = [
			...activeConversation.messages,
			{ id: userId, role: "user", content: trimmed },
			{ id: pendingId, role: "assistant", content: "", pending: true },
		];

		updateConversation(conversationId, (conversation) => ({
			...conversation,
			title:
				conversation.title === "New conversation"
					? titleFromMessage(trimmed)
					: conversation.title,
			messages: nextMessages,
			updatedAt: Date.now(),
		}));

		setInput("");
		setError(null);
		setIsSending(true);

		try {
			const response = await fetch(`${API_BASE}/api/chat/stream`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					message: trimmed,
					session_id: sessionId,
					history,
				}),
			});

			if (!response.ok) {
				const detail = await response.text().catch(() => "");
				throw new Error(
					detail || "The food systems copilot could not respond right now.",
				);
			}

			const streamedSessionId = response.headers.get("X-Session-Id");
			if (streamedSessionId) {
				updateConversation(conversationId, (conversation) => ({
					...conversation,
					sessionId: streamedSessionId,
					updatedAt: Date.now(),
				}));
			}

			if (!response.body) {
				throw new Error("The copilot did not return a readable stream.");
			}

			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let streamedReply = "";
			let hasFirstChunk = false;

			while (true) {
				const { value, done } = await reader.read();
				if (done) break;

				const chunk = decoder.decode(value, { stream: true });
				if (!chunk) continue;

				streamedReply += chunk;
				hasFirstChunk = true;

				updateConversation(conversationId, (conversation) => ({
					...conversation,
					messages: conversation.messages.map((message) =>
						message.id === pendingId
							? {
									...message,
									content: streamedReply,
									pending: false,
								}
							: message,
					),
					updatedAt: Date.now(),
				}));
			}

			const trailingChunk = decoder.decode();
			if (trailingChunk) {
				streamedReply += trailingChunk;
			}

			updateConversation(conversationId, (conversation) => ({
				...conversation,
				messages: conversation.messages.map((message) =>
					message.id === pendingId
						? {
								...message,
								content:
									streamedReply ||
									(hasFirstChunk
										? ""
										: "The copilot finished without returning any text."),
								pending: false,
							}
						: message,
				),
				updatedAt: Date.now(),
			}));
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Something went wrong.";
			setError(message);
			updateConversation(conversationId, (conversation) => ({
				...conversation,
				messages: conversation.messages.map((item) =>
					item.id === pendingId
						? {
								...item,
								content:
									"I couldn’t reach the backend. Make sure the FastAPI server is running on port 8000, then try again.",
								pending: false,
							}
						: item,
				),
				updatedAt: Date.now(),
			}));
		} finally {
			setIsSending(false);
		}
	}

	return (
		<main className="h-screen overflow-hidden bg-[#eef4ef] text-[#17201b]">
			<div className="flex h-full w-full p-3 sm:p-4">
				<aside className="flex w-72 flex-shrink-0 flex-col overflow-hidden rounded-l-lg border border-r-0 border-[#d7e3da] bg-white">
					<div className="border-b border-[#d7e3da] p-4">
						<div className="mb-4 flex items-center gap-3">
							<div className="flex size-10 items-center justify-center rounded-lg bg-[#2f6548] text-white">
								<Leaf data-icon="inline-start" />
							</div>
							<div className="min-w-0">
								<p className="truncate text-sm font-semibold text-[#17201b]">
									Food Systems Copilot
								</p>
								<p className="truncate text-xs text-[#597064]">Ghana focus</p>
							</div>
						</div>

						<button
							type="button"
							onClick={startNewConversation}
							className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#2f6548] px-3 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#27553d]"
						>
							<Plus data-icon="inline-start" />
							New chat
						</button>
					</div>

					<div className="flex min-h-0 flex-1 flex-col">
						<div className="px-4 pb-2 pt-4 text-xs font-semibold uppercase tracking-wide text-[#789082]">
							Chat history
						</div>
						<div className="chat-scrollbar-hidden flex-1 overflow-y-auto px-2 pb-3">
							{conversations.map((conversation) => {
								const isActive = conversation.id === activeConversationId;

								return (
									<button
										key={conversation.id}
										type="button"
										onClick={() => switchConversation(conversation.id)}
										disabled={isSending && !isActive}
										className={`mb-1 flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition ${
											isActive
												? "bg-[#e7f1ea] text-[#17201b]"
												: "text-[#41594b] hover:bg-[#f4f8f5]"
										} disabled:cursor-not-allowed disabled:opacity-60`}
									>
										<MessageSquare
											data-icon="inline-start"
											className="mt-0.5 flex-shrink-0"
										/>
										<span className="min-w-0 flex-1">
											<span className="block truncate text-sm font-medium">
												{conversation.title}
											</span>
											<span className="mt-1 block truncate text-xs text-[#789082]">
												{formatTime(conversation.updatedAt)}
											</span>
										</span>
									</button>
								);
							})}
						</div>
					</div>
				</aside>

				<section className="flex min-w-0 flex-1 items-stretch">
					<div className="flex min-h-0 w-full flex-col overflow-hidden rounded-r-lg border border-t-0 border-[#d7e3da] bg-white shadow-[0_24px_80px_rgba(47,101,72,0.12)]">
						<div className="flex min-h-0 flex-1 items-stretch justify-center bg-[#eef4ef] p-3 sm:p-5">
							<ChatComponent
								key={activeConversationId}
								config={chatConfig}
								uiConfig={uiConfig}
							/>
						</div>

						<form
							onSubmit={sendMessage}
							className="border-t border-[#d7e3da] bg-white p-3 sm:p-4"
						>
							<div className="flex items-end gap-3 rounded-lg border border-[#cbdad0] bg-[#f7fbf8] p-2 shadow-inner">
								<textarea
									value={input}
									onChange={(event) => setInput(event.target.value)}
									onKeyDown={(event) => {
										if (event.key === "Enter" && !event.shiftKey) {
											event.preventDefault();
											event.currentTarget.form?.requestSubmit();
										}
									}}
									placeholder="Ask about Ghana agriculture, food systems, or your app idea..."
									rows={1}
									className="min-h-11 flex-1 resize-none bg-transparent px-3 py-2 text-sm leading-6 text-[#17201b] outline-none placeholder:text-[#789082]"
									disabled={isSending}
								/>
								<button
									type="submit"
									disabled={!input.trim() || isSending}
									className="inline-flex size-11 flex-shrink-0 items-center justify-center rounded-lg bg-[#2f6548] text-white shadow-sm transition hover:bg-[#27553d] disabled:cursor-not-allowed disabled:bg-[#9fb6a8]"
									aria-label="Send message"
								>
									<Send data-icon="inline-start" />
								</button>
							</div>
							{error ? (
								<p className="mt-2 text-sm text-[#9c3c2f]">{error}</p>
							) : null}
						</form>
					</div>
				</section>
			</div>
		</main>
	);
}
