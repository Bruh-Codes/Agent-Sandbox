export const queryKeys = {
  threads: {
    all: ["threads"] as const,
    list: () => [...queryKeys.threads.all, "list"] as const,
    detail: (id: string) => [...queryKeys.threads.all, "detail", id] as const,
  },
  messages: {
    all: (threadId: string) =>
      [...queryKeys.threads.detail(threadId), "messages"] as const,
    list: (threadId: string) =>
      [...queryKeys.messages.all(threadId), "list"] as const,
  },
  session: {
    all: ["session"] as const,
    current: () => [...queryKeys.session.all, "current"] as const,
  },
};
