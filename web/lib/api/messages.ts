export type MessageRow = {
  id: string;
  threadId: string;
  parentId: string | null;
  format: string;
  content: unknown;
  createdAt: string;
};

async function apiJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  const res = await fetch(url, init);
  if (!res.ok) return null;
  return res.json();
}

export const messagesApi = {
  async list(threadId: string): Promise<MessageRow[]> {
    const rows: MessageRow[] | null = await apiJson(
      `/api/threads/${threadId}/messages`,
    );
    return rows ?? [];
  },

  async append(
    threadId: string,
    body: {
      id: string;
      parent_id: string | null;
      format: string;
      content: unknown;
    },
  ): Promise<void> {
    await fetch(`/api/threads/${threadId}/messages`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
};
