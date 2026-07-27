"use client";

import {
  RuntimeAdapterProvider,
  useAui,
  type RemoteThreadListAdapter,
  type ThreadHistoryAdapter,
} from "@assistant-ui/react";
import { createAssistantStream } from "assistant-stream";
import { useMemo } from "react";
import { threadsApi } from "@/lib/api/threads";
import { messagesApi } from "@/lib/api/messages";

export const threadListAdapter: RemoteThreadListAdapter = {
  async list() {
    return threadsApi.list();
  },

  async initialize() {
    return threadsApi.create();
  },

  async rename(remoteId, title) {
    await threadsApi.rename(remoteId, title);
  },

  async archive(remoteId) {
    await threadsApi.archive(remoteId);
  },

  async unarchive(remoteId) {
    await threadsApi.unarchive(remoteId);
  },

  async delete(remoteId) {
    await threadsApi.remove(remoteId);
  },

  async fetch(remoteId) {
    const thread = await threadsApi.get(remoteId);
    if (!thread) return { remoteId, status: "regular" as const };
    return thread;
  },

  async generateTitle(remoteId, messages) {
    return createAssistantStream(async (controller) => {
      const title = await threadsApi.generateTitle(remoteId, messages);
      controller.appendText(title);
    });
  },

  unstable_Provider({ children }) {
    const aui = useAui();
    const history = useMemo<ThreadHistoryAdapter>(
      () => ({
        async load() {
          return { messages: [] };
        },
        async append() {},
        withFormat: (fmt) => ({
          async load() {
            const { remoteId } = aui.threadListItem().getState();
            if (!remoteId) return { messages: [] };
            const rows = await messagesApi.list(remoteId);
            return {
              messages: rows.map((row) =>
                fmt.decode({
                  id: row.id,
                  parent_id: row.parentId ?? null,
                  format: row.format,
                  content: row.content as never,
                }),
              ),
            };
          },
          async append(item) {
            const { remoteId } = await aui.threadListItem().initialize();
            await messagesApi.append(remoteId, {
              id: fmt.getId(item.message),
              parent_id: item.parentId,
              format: fmt.format,
              content: fmt.encode(item),
            });
          },
        }),
      }),
      [aui],
    );
    return (
      <RuntimeAdapterProvider adapters={{ history }}>
        {children}
      </RuntimeAdapterProvider>
    );
  },
};
