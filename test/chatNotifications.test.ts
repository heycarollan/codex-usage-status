import assert from "node:assert/strict";
import test from "node:test";
import {
  formatChatCompletion,
  getCompletionActionLabel,
  isValidCodexThreadId,
  getCompletionNotificationPlan
} from "../src/chatNotifications";

test("plans completion delivery from focus state and the configured mode", () => {
  assert.deepEqual(getCompletionNotificationPlan(true, "native"), { native: false, vscode: true });
  assert.deepEqual(getCompletionNotificationPlan(false, "native"), { native: true, vscode: false });
  assert.deepEqual(getCompletionNotificationPlan(false, "vscode"), { native: false, vscode: true });
  assert.deepEqual(getCompletionNotificationPlan(false, "both"), { native: true, vscode: true });
});

test("labels configured completion chat actions", () => {
  assert.equal(getCompletionActionLabel("exact"), "Go to Chat");
  assert.equal(getCompletionActionLabel("sidebar"), "Open Codex");
  assert.equal(getCompletionActionLabel("none"), null);
});

test("accepts only safe local Codex thread identifiers", () => {
  assert.equal(isValidCodexThreadId("019f-demo-abc123"), true);
  assert.equal(isValidCodexThreadId("unknown"), false);
  assert.equal(isValidCodexThreadId("../settings"), false);
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

  assert.equal(presentation.message, "Chat ABC123 completed.");
});
