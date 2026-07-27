import { FormEvent, useEffect, useMemo, useState } from "react";
import { MessageSquare, Plus, Send } from "lucide-react";
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
const STORAGE_KEY = "farmdesk-v1";

const assistantAvatar =
	"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'%3E%3Crect width='96' height='96' rx='24' fill='%231a7a48'/%3E%3Cpath d='M26 58c18-2 29-13 36-34 9 15 8 34-4 45-10 10-26 10-35 1 7-1 18-5 27-16-11 7-20 9-24 4z' fill='%23f1f7f2'/%3E%3Cpath d='M32 70c9-14 20-25 36-34' fill='none' stroke='%23cfe3d5' stroke-width='5' stroke-linecap='round'/%3E%3C/svg%3E";

const userAvatar =
	"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'%3E%3Crect width='96' height='96' rx='24' fill='%23e8f2ec'/%3E%3Ccircle cx='48' cy='36' r='16' fill='%231a7a48'/%3E%3Cpath d='M22 78c4-18 17-28 26-28s22 10 26 28' fill='%231a7a48'/%3E%3C/svg%3E";

const starterMessages: ChatItem[] = [
	{
		id: 1,
		role: "assistant",
		content: "Hi, I'm your FarmDesk. Tell me what you need.",
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

		return parsed.map((conversation) => ({
			...conversation,
			messages:
				Array.isArray(conversation.messages) && conversation.messages.length > 0
					? conversation.messages.map((message) => ({
							...message,
							content: String(message.content),
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
		backgroundColor: "#f5f7f5",
		loader: {
			dotColor: "#3d8b5e",
		},
		linkBubbles: {
			backgroundColor: "#e8f2ec",
			textColor: "#1a7a48",
			iconColor: "#1a7a48",
			borderColor: "#dce3de",
		},
		leftChat: {
			backgroundColor: "#ffffff",
			textColor: "#1d2320",
			borderColor: "#dce3de",
			showBorder: true,
			nameColor: "#3d8b5e",
		},
		rightChat: {
			backgroundColor: "#1a7a48",
			textColor: "#ffffff",
			borderColor: "#1a7a48",
			showBorder: false,
			nameColor: "#4a7b5d",
		},
	};

	const chatConfig: ChatConfig = useMemo(
		() => ({
			leftPerson: {
				name: "FarmDesk",
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
				throw new Error(detail || "The advisor could not respond right now.");
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
		<main className="h-screen overflow-hidden bg-farm-bg text-farm-text">
			<div className="flex h-full w-full p-3 sm:p-4">
				<aside className="flex w-72 flex-shrink-0 flex-col overflow-hidden rounded-l-lg border border-r-0 border-farm-border bg-white">
					<div className="border-b border-farm-border p-4">
						<div className="mb-4 flex items-center gap-3">
							<div className="flex size-10 items-center justify-center rounded-lg bg-farm-primary">
								<img
									src={assistantAvatar}
									alt="FarmDesk"
									className="size-10 rounded-lg"
								/>
							</div>
							<div className="min-w-0">
								<p className="truncate text-sm font-semibold text-farm-text">
									FarmDesk
								</p>
							</div>
						</div>

						<button
							type="button"
							onClick={startNewConversation}
							className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-farm-primary px-3 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-farm-primary-hover"
						>
							<Plus data-icon="inline-start" />
							New chat
						</button>
					</div>

					<div className="flex min-h-0 flex-1 flex-col">
						<div className="px-4 pb-2 pt-4 text-xs font-semibold uppercase tracking-wide text-farm-muted">
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
												? "bg-farm-primary-light text-farm-text"
												: "text-farm-muted hover:bg-farm-bg"
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
											<span className="mt-1 block truncate text-xs text-farm-muted">
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
					<div className="flex min-h-0 w-full flex-col overflow-hidden rounded-r-lg border border-t-0 border-farm-border bg-white shadow-[0_24px_80px_rgba(26,122,72,0.1)]">
						<div className="flex min-h-0 flex-1 items-stretch justify-center bg-farm-bg p-3 sm:p-5">
							<ChatComponent
								key={activeConversationId}
								config={chatConfig}
								uiConfig={uiConfig}
							/>
						</div>

						<form
							onSubmit={sendMessage}
							className="border-t border-farm-border bg-white p-3 sm:p-4"
						>
							<div className="flex items-end gap-3 rounded-lg border border-farm-input-border bg-farm-input-bg p-2 shadow-inner">
								<textarea
									value={input}
									onChange={(event) => setInput(event.target.value)}
									onKeyDown={(event) => {
										if (event.key === "Enter" && !event.shiftKey) {
											event.preventDefault();
											event.currentTarget.form?.requestSubmit();
										}
									}}
									placeholder="tell me what you need"
									rows={1}
									className="min-h-11 flex-1 resize-none bg-transparent px-3 py-2 text-sm leading-6 text-farm-text outline-none placeholder:text-farm-placeholder"
									disabled={isSending}
								/>
								<button
									type="submit"
									disabled={!input.trim() || isSending}
									className="inline-flex size-11 flex-shrink-0 items-center justify-center rounded-lg bg-farm-primary text-white shadow-sm transition hover:bg-farm-primary-hover disabled:cursor-not-allowed disabled:bg-farm-muted"
									aria-label="Send message"
								>
									<Send data-icon="inline-start" />
								</button>
							</div>
							{error ? (
								<p className="mt-2 text-sm text-farm-error">{error}</p>
							) : null}
						</form>
					</div>
				</section>
			</div>
		</main>
	);
}
