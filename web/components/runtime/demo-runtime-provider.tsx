"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";
import { AssistantCloud } from "assistant-cloud";
import { ReloadOnAuth } from "./ReloadOnAuth";

const cloudApiKey = process.env.NEXT_PUBLIC_ASSISTANT_CLOUD_API_KEY;

const cloud = cloudApiKey
	? new AssistantCloud({
			apiKey: cloudApiKey,
			userId: "user",
			workspaceId: "default",
		})
	: undefined;

export function DemoRuntimeProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const runtime = useChatRuntime({
		...(cloud ? { cloud } : {}),
	});

	return (
		<AssistantRuntimeProvider runtime={runtime}>
			{children}
			<ReloadOnAuth />
		</AssistantRuntimeProvider>
	);
}
