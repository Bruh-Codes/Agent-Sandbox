"use client";

import {
  RuntimeAdapterProvider,
  useAui,
  type RemoteThreadListAdapter,
  type ThreadHistoryAdapter,
} from "@assistant-ui/react";
import { createAssistantStream } from "assistant-stream";
import { useMemo } from "react";

async function apiJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  const res = await fetch(url, init);
  if (!res.ok) return null;
  return res.json();
}

export const threadListAdapter: RemoteThreadListAdapter = {
  async list() {
    const rows: any[] | null = await apiJson("/api/threads");
    if (!rows) return { threads: [] };
    return {
      threads: rows.map((t: any) => ({
        remoteId: t.id,
        title: t.title ?? undefined,
        status: t.status,
        lastMessageAt: t.updatedAt ? new Date(t.updatedAt) : undefined,
      })),
    };
  },
  async initialize() {
    const data: { id?: string } | null = await apiJson("/api/threads", {
      method: "POST",
    });
    if (!data?.id) return { remoteId: crypto.randomUUID() };
    return { remoteId: data.id };
  },
  async rename(remoteId, title) {
    await fetch(`/api/threads/${remoteId}`, {
      method: "PATCH",
      body: JSON.stringify({ title }),
    });
  },
  async archive(remoteId) {
    await fetch(`/api/threads/${remoteId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "archived" }),
    });
  },
  async unarchive(remoteId) {
    await fetch(`/api/threads/${remoteId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "regular" }),
    });
  },
  async delete(remoteId) {
    await fetch(`/api/threads/${remoteId}`, { method: "DELETE" });
  },
  async fetch(remoteId) {
    const t: any | null = await apiJson(`/api/threads/${remoteId}`);
    if (!t) return { remoteId, status: "regular" };
    return {
      remoteId: t.id,
      title: t.title ?? undefined,
      status: t.status,
      lastMessageAt: t.updatedAt ? new Date(t.updatedAt) : undefined,
    };
  },
  async generateTitle(remoteId, messages) {
    return createAssistantStream(async (controller) => {
      const data: { title?: string } | null = await apiJson(
        `/api/threads/${remoteId}/title`,
        { method: "POST", body: JSON.stringify({ messages }) },
      );
      controller.appendText(data?.title ?? "Chat");
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
            const rows: any[] | null = await apiJson(
              `/api/threads/${remoteId}/messages`,
            );
            if (!rows) return { messages: [] };
            return {
              messages: rows.map((row: any) =>
                fmt.decode({
                  id: row.id,
                  parent_id: row.parent_id,
                  format: row.format,
                  content: row.content,
                }),
              ),
            };
          },
          async append(item) {
            const { remoteId } = await aui.threadListItem().initialize();
            await fetch(`/api/threads/${remoteId}/messages`, {
              method: "POST",
              body: JSON.stringify({
                id: fmt.getId(item.message),
                parent_id: item.parentId,
                format: fmt.format,
                content: fmt.encode(item),
              }),
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
