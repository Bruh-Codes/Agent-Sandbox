"use client";

import React, {
	useState,
	useEffect,
	useRef,
	useMemo,
	useCallback,
} from "react";
import { motion, AnimatePresence } from "motion/react";
import { Link2 } from "lucide-react";

interface LoaderConfig {
	enabled: boolean;
	delay?: number;
	duration?: number;
}

interface Link {
	text: string;
}

interface Message {
	id: number;
	sender: "left" | "right";
	type: "text" | "image" | "text-with-links";
	content: string;
	maxWidth?: string;
	loader?: LoaderConfig;
	links?: Link[];
}

interface Person {
	name: string;
	avatar: string;
}

interface ChatStyle {
	backgroundColor: string;
	textColor: string;
	borderColor: string;
	showBorder: boolean;
	nameColor?: string;
}

interface LinkBubbleStyle {
	backgroundColor: string;
	textColor: string;
	iconColor: string;
	borderColor: string;
}

interface UiConfig {
	containerWidth?: number | string;
	containerHeight?: number | string;
	backgroundColor?: string;
	autoRestart?: boolean;
	restartDelay?: number;
	loader?: {
		dotColor?: string;
	};
	linkBubbles?: LinkBubbleStyle;
	leftChat?: ChatStyle;
	rightChat?: ChatStyle;
}

interface ChatConfig {
	leftPerson: Person;
	rightPerson: Person;
	messages: Message[];
}

interface ChatComponentProps {
	config: ChatConfig;
	uiConfig?: UiConfig;
}

interface MessageLoaderProps {
	dotColor?: string;
}

interface LinkBadgeProps {
	link: Link;
	linkStyle: LinkBubbleStyle;
}

interface MessageBubbleProps {
	message: Message;
	isLeft: boolean;
	uiConfig: Required<UiConfig>;
	onContentReady?: () => void;
	isLoading: boolean;
	isVisible: boolean;
}

interface MessageWrapperProps {
	message: Message;
	config: ChatConfig;
	uiConfig: Required<UiConfig>;
	previousMessageComplete: boolean;
	onMessageComplete?: (messageId: number) => void;
	previousMessage: Message | null;
	nextMessage: Message | null;
	onVisibilityChange?: (messageId: number) => void;
	isNextVisible: boolean;
}

const hexToRgba = (hex: string, alpha: number): string => {
	const r = parseInt(hex.slice(1, 3), 16);
	const g = parseInt(hex.slice(3, 5), 16);
	const b = parseInt(hex.slice(5, 7), 16);
	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const MessageLoader = React.memo<MessageLoaderProps>(
	({ dotColor = "#9ca3af" }) => {
		const dotAnimation = {
			y: [0, -6, 0],
		};

		const dotTransition = (delay = 0) => ({
			duration: 0.6,
			repeat: Infinity,
			ease: "easeInOut" as const,
			delay,
		});

		return (
			<motion.div
				className="flex items-center gap-1 px-3 py-2"
				initial={{ opacity: 0, scale: 0.8 }}
				animate={{ opacity: 1, scale: 1 }}
				exit={{ opacity: 0, scale: 0.8 }}
			>
				{[0, 0.15, 0.3].map((delay, i) => (
					<motion.div
						key={i}
						className="size-1.5 rounded-full"
						style={{ backgroundColor: dotColor }}
						animate={dotAnimation}
						transition={dotTransition(delay)}
					/>
				))}
			</motion.div>
		);
	},
);

MessageLoader.displayName = "MessageLoader";

const LinkBadge = React.memo<LinkBadgeProps>(({ link, linkStyle }) => (
	<div
		className="inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs tracking-wide"
		style={{
			backgroundColor: linkStyle.backgroundColor,
			color: linkStyle.textColor,
			borderColor: linkStyle.borderColor,
		}}
	>
		<Link2 size={12} color={linkStyle.iconColor} />
		<span>{link.text}</span>
	</div>
));

LinkBadge.displayName = "LinkBadge";

const MessageBubble = React.memo<MessageBubbleProps>(
	({ message, isLeft, uiConfig, onContentReady, isLoading, isVisible }) => {
		const [imageLoaded, setImageLoaded] = useState(false);
		const [expanded, setExpanded] = useState(false);
		const chatStyle = isLeft ? uiConfig.leftChat : uiConfig.rightChat;

		const SHORTEN_THRESHOLD = 400;

		const renderInlineMarkdown = useCallback(
			(text: string) => {
				const nodes: React.ReactNode[] = [];

				// Split text into parts: bold **text**, urls, and plain text
				const urlRegex = /(https?:\/\/[\w\-._~:\/?#\[\]@!$&'()*+,;=%]+)/g;
				const boldRegex = /\*\*(.+?)\*\*/g;

				let lastIndex = 0;
				// Process URLs first by splitting
				const parts = text.split(urlRegex);

				parts.forEach((part, i) => {
					if (urlRegex.test(part)) {
						nodes.push(
							<a
								key={`u-${i}-${part}`}
								href={part}
								target="_blank"
								rel="noopener noreferrer"
								style={{ color: uiConfig.linkBubbles.iconColor }}
							>
								{part}
							</a>,
						);
						return;
					}

					let match: RegExpExecArray | null;
					let localLast = 0;
					while ((match = boldRegex.exec(part)) !== null) {
						const before = part.slice(localLast, match.index);
						if (before) nodes.push(before);
						nodes.push(
							<strong key={`b-${i}-${match.index}`}>{match[1]}</strong>,
						);
						localLast = match.index + match[0].length;
					}

					const remaining = part.slice(localLast);
					if (remaining) nodes.push(remaining);
				});

				return nodes;
			},
			[uiConfig.linkBubbles.iconColor],
		);

		const renderMarkdown = useCallback(
			(content: string) => {
				const lines = content.split(/\r?\n/);
				const elements: React.ReactNode[] = [];
				let i = 0;

				while (i < lines.length) {
					const line = lines[i].trim();
					if (!line) {
						elements.push(<br key={`br-${i}`} />);
						i++;
						continue;
					}

					// Heading
					const headingMatch = line.match(/^(#{1,6})\s+(.*)/);
					if (headingMatch) {
						const level = Math.min(6, headingMatch[1].length);
						const text = headingMatch[2];
						elements.push(
							React.createElement(
								`h${level}`,
								{
									key: `h-${i}`,
									style: { margin: "0.25rem 0", color: chatStyle.textColor },
								},
								renderInlineMarkdown(text),
							),
						);
						i++;
						continue;
					}

					// Unordered list
					if (/^[-*]\s+/.test(line)) {
						const items: React.ReactNode[] = [];
						while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
							items.push(
								<li key={`li-${i}`} style={{ marginBottom: 4 }}>
									{renderInlineMarkdown(
										lines[i].trim().replace(/^[-*]\s+/, ""),
									)}
								</li>,
							);
							i++;
						}
						elements.push(
							<ul
								key={`ul-${i}`}
								style={{ paddingLeft: 18, margin: "0.25rem 0" }}
							>
								{items}
							</ul>,
						);
						continue;
					}

					// Paragraph
					elements.push(
						<p
							key={`p-${i}`}
							className="whitespace-pre-wrap text-base leading-relaxed [overflow-wrap:anywhere]"
							style={{ color: chatStyle.textColor, margin: "0.25rem 0" }}
						>
							{renderInlineMarkdown(line)}
						</p>,
					);
					i++;
				}

				return elements;
			},
			[chatStyle.textColor, renderInlineMarkdown],
		);

		useEffect(() => {
			if (
				isVisible &&
				(message.type === "text" || message.type === "text-with-links")
			) {
				onContentReady?.();
			}
		}, [isVisible, message.type, onContentReady]);

		const handleImageLoad = useCallback(() => {
			setImageLoaded(true);
			onContentReady?.();
		}, [onContentReady]);

		const bubbleStyle = useMemo(
			() => ({
				backgroundColor: chatStyle.backgroundColor,
				color: chatStyle.textColor,
				borderColor: chatStyle.borderColor,
				borderWidth: chatStyle.showBorder ? "0.5px" : "0",
			}),
			[
				chatStyle.backgroundColor,
				chatStyle.textColor,
				chatStyle.borderColor,
				chatStyle.showBorder,
			],
		);

		const roundedClass = isLeft
			? "rounded-br-lg rounded-tl-lg rounded-tr-lg"
			: "rounded-bl-lg rounded-tl-lg rounded-tr-lg";
		const paddingClass = message.type === "image" ? "p-1" : "p-4";
		const maxWidthClass = message.maxWidth || "max-w-2xl";

		return (
			<div
				className={`${roundedClass} ${paddingClass} ${maxWidthClass} relative border-solid`}
				style={bubbleStyle}
			>
				<AnimatePresence mode="wait">
					{isLoading && !isVisible ? (
						<motion.div
							key="loader"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.2 }}
							className={
								message.type === "image"
									? "flex items-center justify-center p-3"
									: "flex items-center justify-center"
							}
						>
							<MessageLoader dotColor={uiConfig.loader?.dotColor} />
						</motion.div>
					) : isVisible ? (
						<motion.div
							key="content"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							transition={{ duration: 0.3 }}
						>
							{message.type === "text" && (
								<div>
									{message.content.length > SHORTEN_THRESHOLD && !expanded ? (
										<div>
											{renderMarkdown(
												message.content.slice(0, SHORTEN_THRESHOLD) + "...",
											)}
											<button
												onClick={() => setExpanded(true)}
												className="mt-2 text-xs font-medium"
												style={{ color: uiConfig.linkBubbles.iconColor }}
											>
												Show more
											</button>
										</div>
									) : (
										<div>
											{renderMarkdown(message.content)}
											{message.content.length > SHORTEN_THRESHOLD && (
												<button
													onClick={() => setExpanded(false)}
													className="mt-2 text-xs font-medium"
													style={{ color: uiConfig.linkBubbles.iconColor }}
												>
													Show less
												</button>
											)}
										</div>
									)}
								</div>
							)}

							{message.type === "image" && (
								<div className="relative min-h-32">
									{!imageLoaded && (
										<div className="flex h-32 w-full items-center justify-center">
											<MessageLoader dotColor={uiConfig.loader?.dotColor} />
										</div>
									)}
									<img
										src={message.content}
										alt="Chat image"
										className={`max-h-full max-w-48 rounded object-cover ${!imageLoaded ? "hidden" : ""}`}
										onLoad={handleImageLoad}
									/>
								</div>
							)}

							{message.type === "text-with-links" && (
								<div>
									<div className="mb-3">
										{message.content.length > SHORTEN_THRESHOLD && !expanded ? (
											<div>
												{renderMarkdown(
													message.content.slice(0, SHORTEN_THRESHOLD) + "...",
												)}
												<button
													onClick={() => setExpanded(true)}
													className="mt-2 text-xs font-medium"
													style={{ color: uiConfig.linkBubbles.iconColor }}
												>
													Show more
												</button>
											</div>
										) : (
											<div>
												{renderMarkdown(message.content)}
												{message.content.length > SHORTEN_THRESHOLD && (
													<button
														onClick={() => setExpanded(false)}
														className="mt-2 text-xs font-medium"
														style={{ color: uiConfig.linkBubbles.iconColor }}
													>
														Show less
													</button>
												)}
											</div>
										)}
									</div>
									<div className="flex flex-wrap gap-1">
										{message.links?.map((link, index) => (
											<LinkBadge
												key={index}
												link={link}
												linkStyle={uiConfig.linkBubbles}
											/>
										))}
									</div>
								</div>
							)}
						</motion.div>
					) : null}
				</AnimatePresence>
			</div>
		);
	},
);

MessageBubble.displayName = "MessageBubble";

const MessageWrapper = React.memo<MessageWrapperProps>(
	({
		message,
		config,
		uiConfig,
		previousMessageComplete,
		onMessageComplete,
		previousMessage,
		nextMessage,
		onVisibilityChange,
		isNextVisible,
	}) => {
		const [isLoading, setIsLoading] = useState(false);
		const [isVisible, setIsVisible] = useState(false);
		const [messageCompleted, setMessageCompleted] = useState(false);

		const isLeft = message.sender === "left";
		const person = isLeft ? config.leftPerson : config.rightPerson;
		const chatStyle = isLeft ? uiConfig.leftChat : uiConfig.rightChat;

		const isContinuation = previousMessage?.sender === message.sender;
		const nextMessageSameSender = nextMessage?.sender === message.sender;
		const shouldShowAvatar = !nextMessageSameSender || !isNextVisible;

		useEffect(() => {
			if (!previousMessageComplete) return;

			const { loader } = message;
			const loaderDelay = loader?.delay ?? 500;
			const totalDelay = loaderDelay + (loader?.duration || 1000);

			if (loader?.enabled) {
				const loaderTimeout = setTimeout(() => setIsLoading(true), loaderDelay);
				const messageTimeout = setTimeout(() => {
					setIsLoading(false);
					setIsVisible(true);
					onVisibilityChange?.(message.id);
				}, totalDelay);

				return () => {
					clearTimeout(loaderTimeout);
					clearTimeout(messageTimeout);
				};
			}

			const messageTimeout = setTimeout(() => {
				setIsVisible(true);
				onVisibilityChange?.(message.id);
			}, 0);

			return () => clearTimeout(messageTimeout);
		}, [message, previousMessageComplete, onVisibilityChange]);

		const handleContentReady = useCallback(() => {
			if (!messageCompleted) {
				setMessageCompleted(true);
				setTimeout(() => onMessageComplete?.(message.id), 350);
			}
		}, [messageCompleted, onMessageComplete, message.id]);

		const messageClass = useMemo(
			() =>
				isLeft
					? "flex w-full items-end gap-3"
					: "flex w-full flex-row-reverse items-end gap-3",
			[isLeft],
		);

		if (!isLoading && !isVisible) return null;

		return (
			<div className={messageClass}>
				<AnimatePresence mode="wait">
					{shouldShowAvatar ? (
						<motion.img
							key="avatar"
							src={person.avatar}
							alt={person.name}
							className="size-8 flex-shrink-0 rounded-full border-[1.5px] border-white object-cover"
							initial={{ opacity: 0, scale: 0 }}
							animate={{ opacity: 1, scale: 1 }}
							exit={{ opacity: 0, scale: 0 }}
							transition={{ duration: 0.2 }}
						/>
					) : (
						<div className="size-8 flex-shrink-0" key="spacer" />
					)}
				</AnimatePresence>

				<motion.div
					initial={{ opacity: 0, scale: 0.9 }}
					animate={{ opacity: 1, scale: 1 }}
					transition={{ duration: 0.35, ease: "easeOut" }}
					className="flex max-w-[calc(100%-2.75rem)] flex-col"
					style={{ alignItems: isLeft ? "flex-start" : "flex-end" }}
				>
					{!isContinuation && (
						<motion.div
							className="mb-1 text-xs leading-relaxed"
							style={{ color: chatStyle.nameColor || "#582F0E" }}
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							transition={{ delay: 0.15, duration: 0.25 }}
						>
							{person.name}
						</motion.div>
					)}

					<MessageBubble
						message={message}
						isLeft={isLeft}
						uiConfig={uiConfig}
						onContentReady={handleContentReady}
						isLoading={isLoading}
						isVisible={isVisible}
					/>
				</motion.div>
			</div>
		);
	},
);

MessageWrapper.displayName = "MessageWrapper";

const ChatComponent: React.FC<ChatComponentProps> = ({
	config,
	uiConfig = {},
}) => {
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);

	const [completedMessages, setCompletedMessages] = useState<number[]>([]);
	const [visibleMessages, setVisibleMessages] = useState<number[]>([]);
	const [key, setKey] = useState(0);

	const defaultUiConfig: Required<UiConfig> = {
		containerWidth: 760,
		containerHeight: 500,
		backgroundColor: "#ffffff",
		autoRestart: false,
		restartDelay: 3000,
		loader: { dotColor: "#9ca3af" },
		linkBubbles: {
			backgroundColor: "#f1f5f9",
			textColor: "#0f172a",
			iconColor: "#065f46",
			borderColor: "#e2e8f0",
		},
		leftChat: {
			backgroundColor: "#eef7ef",
			textColor: "#0f172a",
			borderColor: "#d1d1d1",
			showBorder: true,
			nameColor: "#065f46",
		},
		rightChat: {
			backgroundColor: "#f8fafc",
			textColor: "#0f172a",
			borderColor: "#d1d1d1",
			showBorder: true,
			nameColor: "#0f172a",
		},
	};

	const ui: Required<UiConfig> = {
		...defaultUiConfig,
		...uiConfig,
		loader: { ...defaultUiConfig.loader, ...uiConfig.loader },
		linkBubbles: { ...defaultUiConfig.linkBubbles, ...uiConfig.linkBubbles },
		leftChat: { ...defaultUiConfig.leftChat, ...uiConfig.leftChat },
		rightChat: { ...defaultUiConfig.rightChat, ...uiConfig.rightChat },
	};

	const handleMessageComplete = useCallback(
		(messageId: number) => {
			setCompletedMessages((prev) => {
				const newCompleted = prev.includes(messageId)
					? prev
					: [...prev, messageId];

				if (newCompleted.length === config.messages.length && ui.autoRestart) {
					setTimeout(() => {
						setCompletedMessages([]);
						setVisibleMessages([]);
						setKey((prevKey) => prevKey + 1);
					}, ui.restartDelay);
				}

				return newCompleted;
			});
		},
		[config.messages.length, ui.autoRestart, ui.restartDelay],
	);

	const handleVisibilityChange = useCallback((messageId: number) => {
		setVisibleMessages((prev) =>
			prev.includes(messageId) ? prev : [...prev, messageId],
		);
	}, []);

	const scrollToBottom = useCallback(() => {
		messagesEndRef.current?.scrollIntoView({
			behavior: "smooth",
			block: "end",
			inline: "nearest",
		});
	}, []);

	useEffect(() => {
		const observer = new MutationObserver(scrollToBottom);

		if (containerRef.current) {
			observer.observe(containerRef.current, {
				childList: true,
				subtree: true,
			});
		}

		return () => observer.disconnect();
	}, [key, scrollToBottom]);

	useEffect(() => {
		scrollToBottom();
	}, [config.messages, completedMessages, scrollToBottom]);

	const gradientBackground = useMemo(() => {
		return `linear-gradient(to bottom, ${hexToRgba(ui.backgroundColor, 1)} 0%, ${hexToRgba(
			ui.backgroundColor,
			0.95,
		)} 20%, ${hexToRgba(ui.backgroundColor, 0.8)} 40%, ${hexToRgba(ui.backgroundColor, 0.4)} 70%, ${hexToRgba(
			ui.backgroundColor,
			0,
		)} 100%)`;
	}, [ui.backgroundColor]);

	return (
		<div
			key={key}
			className="relative mx-auto h-full w-full max-w-full rounded-lg"
			style={{
				width:
					typeof ui.containerWidth === "number"
						? `${ui.containerWidth}px`
						: ui.containerWidth,
				height:
					typeof ui.containerHeight === "number"
						? `${ui.containerHeight}px`
						: ui.containerHeight,
				backgroundColor: ui.backgroundColor,
			}}
		>
			<div
				className="pointer-events-none absolute left-0 right-0 top-0 z-10 h-24 rounded-t-lg"
				style={{ background: gradientBackground }}
			/>

			<div
				ref={containerRef}
				className="chat-scrollbar-hidden h-full overflow-y-scroll"
			>
				<div className="flex min-h-full flex-col justify-end">
					{config.messages.map((message, index) => {
						const previousMessageComplete =
							index === 0 ||
							completedMessages.includes(config.messages[index - 1].id);
						const previousMessage =
							index > 0 ? config.messages[index - 1] : null;
						const nextMessage =
							index < config.messages.length - 1
								? config.messages[index + 1]
								: null;
						const isNextVisible = nextMessage
							? visibleMessages.includes(nextMessage.id)
							: false;
						const isContinuation = previousMessage?.sender === message.sender;
						const spacingClass =
							index === 0 ? "" : isContinuation ? "mt-1.5" : "mt-8";

						return (
							<div key={message.id} className={spacingClass}>
								<MessageWrapper
									message={message}
									config={config}
									uiConfig={ui}
									previousMessageComplete={previousMessageComplete}
									onMessageComplete={handleMessageComplete}
									onVisibilityChange={handleVisibilityChange}
									previousMessage={previousMessage}
									nextMessage={nextMessage}
									isNextVisible={isNextVisible}
								/>
							</div>
						);
					})}
					<div ref={messagesEndRef} className="h-8" />
				</div>
			</div>
		</div>
	);
};

export default ChatComponent;
export type {
	ChatComponentProps,
	ChatConfig,
	UiConfig,
	Message,
	Person,
	ChatStyle,
	LinkBubbleStyle,
};
