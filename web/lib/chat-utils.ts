export function extractText(msg: any): string {
  const parts = msg.parts ?? msg.content;
  if (Array.isArray(parts)) {
    const textParts = parts
      .filter((p: any) => p.type === "text")
      .map((p: any) => p.text)
      .filter(Boolean);
    if (textParts.length > 0) return textParts.join("\n");
  }
  if (typeof msg.content === "string") return msg.content;
  if (msg.text) return msg.text;
  return "";
}

export function toBackendHistory(
  messages: any[],
  excludeLastUser: boolean
): { role: string; content: string }[] {
  const msgs = excludeLastUser ? messages.slice(0, -1) : messages;
  return msgs
    .filter((m: any) => m.role === "user" || m.role === "assistant")
    .map((m: any) => ({
      role: m.role,
      content: extractText(m),
    }))
    .filter((m) => m.content.trim());
}
