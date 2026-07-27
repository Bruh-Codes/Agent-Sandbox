"use client";

import {
  AssistantRuntimeProvider,
  useRemoteThreadListRuntime,
} from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";
import { useSearchParams, useRouter } from "next/navigation";
import { useCallback } from "react";
import { threadListAdapter } from "@/lib/thread-adapter";
import { ReloadOnAuth } from "./ReloadOnAuth";

export function MyProvider({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const threadId = searchParams.get("thread") ?? undefined;

  const onThreadIdChange = useCallback(
    (newThreadId: string | undefined) => {
      const params = new URLSearchParams(searchParams.toString());
      if (newThreadId) {
        params.set("thread", newThreadId);
      } else {
        params.delete("thread");
      }
      router.replace(`/?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const runtime = useRemoteThreadListRuntime({
    runtimeHook: () => useChatRuntime(),
    adapter: threadListAdapter,
    threadId,
    onThreadIdChange,
  });
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
      <ReloadOnAuth />
    </AssistantRuntimeProvider>
  );
}
