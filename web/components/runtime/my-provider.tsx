"use client";

import {
  AssistantRuntimeProvider,
  useRemoteThreadListRuntime,
} from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";
import { threadListAdapter } from "@/lib/thread-adapter";
import { ReloadOnAuth } from "./ReloadOnAuth";

export function MyProvider({ children }: { children: React.ReactNode }) {
  const runtime = useRemoteThreadListRuntime({
    runtimeHook: () => useChatRuntime(),
    adapter: threadListAdapter,
  });
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
      <ReloadOnAuth />
    </AssistantRuntimeProvider>
  );
}
