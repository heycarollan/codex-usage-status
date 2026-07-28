import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCodexIdeChatUri,
  buildNativeNotificationActions,
  formatChatCompletion
} from "../src/chatNotifications";

test("builds the current Codex IDE route for an exact thread", () => {
  assert.equal(
    buildCodexIdeChatUri("vscode", "thread/with spaces"),
    "vscode://openai.chatgpt/local/thread%2Fwith%20spaces"
  );
  assert.equal(buildCodexIdeChatUri("vscode", "unknown"), null);
});

test("formats a completion with stable chat, project, and branch identity", () => {
  const presentation = formatChatCompletion(
    {
      threadId: "019f-demo-abc123",
      turnId: "turn-1",
      status: "completed",
      durationMs: 65000,
      completedAt: 1,
      threadName: "Fix the reset-credit flow",
      cwd: "/home/q/codex-usage-status",
      gitBranch: "codex/actionable-chat-notifications"
    },
    "1m 5s"
  );

  assert.equal(presentation.title, "Codex complete · Fix the reset-credit flow");
  assert.equal(
    presentation.message,
    "Fix the reset-credit flow completed · 1m 5s. codex-usage-status · codex/actionable-chat-notifications."
  );
});

test("falls back to a short non-color chat identifier", () => {
  const presentation = formatChatCompletion(
    {
      threadId: "019f-demo-abc123",
      turnId: null,
      status: null,
      durationMs: null,
      completedAt: null
    },
    null
  );

  assert.equal(presentation.title, "Codex complete · Chat ABC123");
  assert.equal(presentation.message, "Chat ABC123 completed.");
});

test("marks the notification body action as the freedesktop default", () => {
  assert.deepEqual(buildNativeNotificationActions(["Open Chat", "Show Usage"], "Open Chat"), [
    { id: "default", label: "Open Chat" },
    { id: "action-1", label: "Show Usage" }
  ]);
});
