export type ThreadRow = {
  id: string;
  user_id: string;
  title: string | null;
  status: "regular" | "archived";
  custom: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type ThreadListItem = {
  remoteId: string;
  title?: string;
  status: "regular" | "archived";
  lastMessageAt?: Date;
};

export type ThreadListResult = {
  threads: ThreadListItem[];
};

async function apiJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  const res = await fetch(url, init);
  if (!res.ok) return null;
  return res.json();
}

export const threadsApi = {
  async list(): Promise<ThreadListResult> {
    const rows: ThreadRow[] | null = await apiJson("/api/threads");
    if (!rows) return { threads: [] };
    return {
      threads: rows.map((t) => ({
        remoteId: t.id,
        title: t.title ?? undefined,
        status: t.status,
        lastMessageAt: t.updated_at ? new Date(t.updated_at) : undefined,
      })),
    };
  },

  async create(): Promise<{ remoteId: string }> {
    const data: { id?: string } | null = await apiJson("/api/threads", {
      method: "POST",
    });
    if (!data?.id) return { remoteId: crypto.randomUUID() };
    return { remoteId: data.id };
  },

  async get(id: string): Promise<ThreadListItem | null> {
    const t: ThreadRow | null = await apiJson(`/api/threads/${id}`);
    if (!t) return null;
    return {
      remoteId: t.id,
      title: t.title ?? undefined,
      status: t.status,
      lastMessageAt: t.updated_at ? new Date(t.updated_at) : undefined,
    };
  },

  async rename(id: string, title: string): Promise<void> {
    await fetch(`/api/threads/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ title }),
    });
  },

  async archive(id: string): Promise<void> {
    await fetch(`/api/threads/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "archived" }),
    });
  },

  async unarchive(id: string): Promise<void> {
    await fetch(`/api/threads/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "regular" }),
    });
  },

  async remove(id: string): Promise<void> {
    await fetch(`/api/threads/${id}`, { method: "DELETE" });
  },

  async generateTitle(
    id: string,
    messages: readonly unknown[],
  ): Promise<string> {
    const data: { title?: string } | null = await apiJson(
      `/api/threads/${id}/title`,
      { method: "POST", body: JSON.stringify({ messages }) },
    );
    return data?.title ?? "Chat";
  },
};
