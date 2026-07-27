import { describe, it, expect } from "vitest";
import { extractText, toBackendHistory } from "../lib/chat-utils";

describe("extractText", () => {
  it("extracts text from array of parts", () => {
    expect(extractText({ parts: [{ type: "text", text: "Hello" }] })).toBe("Hello");
  });

  it("joins multiple text parts with newline", () => {
    expect(
      extractText({
        parts: [
          { type: "text", text: "Hello" },
          { type: "text", text: "World" },
        ],
      })
    ).toBe("Hello\nWorld");
  });

  it("filters out non-text parts", () => {
    expect(
      extractText({
        parts: [
          { type: "reasoning", text: "thinking..." },
          { type: "text", text: "Result" },
        ],
      })
    ).toBe("Result");
  });

  it("falls back to content string", () => {
    expect(extractText({ content: "Plain content" })).toBe("Plain content");
  });

  it("falls back to text field", () => {
    expect(extractText({ text: "Text field" })).toBe("Text field");
  });

  it("returns empty string for missing content", () => {
    expect(extractText({})).toBe("");
  });

  it("handles null parts", () => {
    expect(extractText({ parts: null })).toBe("");
  });
});

describe("toBackendHistory", () => {
  const userMsg = (content: string) => ({ role: "user", content });
  const asstMsg = (content: string) => ({ role: "assistant", content });

  it("converts user/assistant messages", () => {
    const result = toBackendHistory([userMsg("hi"), asstMsg("hello")], false);
    expect(result).toEqual([
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
    ]);
  });

  it("excludes last user message when excludeLastUser is true", () => {
    const result = toBackendHistory([userMsg("hi"), asstMsg("hello"), userMsg("latest")], true);
    expect(result).toEqual([
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
    ]);
  });

  it("filters out system messages", () => {
    const result = toBackendHistory(
      [{ role: "system", content: "be nice" }, userMsg("ok")],
      false
    );
    expect(result).toEqual([{ role: "user", content: "ok" }]);
  });

  it("filters empty content", () => {
    const result = toBackendHistory(
      [userMsg(""), asstMsg("valid")],
      false
    );
    expect(result).toEqual([{ role: "assistant", content: "valid" }]);
  });
});
