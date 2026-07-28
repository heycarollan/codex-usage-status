import type { CodexTurnCompletedEvent } from "./codexAppServerClient";

const CODEX_EXTENSION_ID = "openai.chatgpt";
const MAX_CHAT_NAME_LENGTH = 72;

export interface ChatCompletionPresentation {
  title: string;
  message: string;
}

export interface NativeNotificationAction {
  id: string;
  label: string;
}

export function buildCodexIdeChatUri(uriScheme: string, threadId: string): string | null {
  const scheme = uriScheme.trim();
  const id = threadId.trim();
  if (!scheme || !id || id === "unknown") {
    return null;
  }

  return `${scheme}://${CODEX_EXTENSION_ID}/local/${encodeURIComponent(id)}`;
}

export function formatChatCompletion(
  event: CodexTurnCompletedEvent,
  durationLabel: string | null
): ChatCompletionPresentation {
  const project = getPathBasename(event.cwd ?? null);
  const branch = cleanInlineText(event.gitBranch ?? null, 48);
  const threadKey = getThreadKey(event.threadId);
  const chatName =
    cleanInlineText(event.threadName ?? null, MAX_CHAT_NAME_LENGTH) ??
    (project ? `Chat in ${project}` : `Chat ${threadKey}`);
  const status = event.status && event.status !== "completed" ? ` · ${cleanInlineText(event.status, 24)}` : "";
  const duration = durationLabel ? ` · ${durationLabel}` : "";
  const context = [project, branch].filter((value): value is string => Boolean(value));
  const contextText = context.length > 0 ? ` ${context.join(" · ")}.` : "";

  return {
    title: `Codex complete · ${chatName}`,
    message: `${chatName} completed${status}${duration}.${contextText}`
  };
}

export function buildNativeNotificationActions(
  actions: readonly string[],
  defaultAction?: string
): NativeNotificationAction[] {
  const uniqueActions = actions.filter((action, index) => action && actions.indexOf(action) === index);

  return uniqueActions.map((label, index) => ({
    id: label === defaultAction ? "default" : `action-${index}`,
    label
  }));
}

function cleanInlineText(value: string | null, maxLength: number): string | null {
  if (!value) {
    return null;
  }

  const cleaned = value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return null;
  }

  return cleaned.length <= maxLength ? cleaned : `${cleaned.slice(0, maxLength - 1).trimEnd()}…`;
}

function getPathBasename(value: string | null): string | null {
  const cleaned = cleanInlineText(value, 512)?.replace(/[\\/]+$/, "");
  if (!cleaned) {
    return null;
  }

  const parts = cleaned.split(/[\\/]/);
  return cleanInlineText(parts[parts.length - 1] ?? null, 48);
}

function getThreadKey(threadId: string): string {
  const compact = threadId.replace(/[^a-zA-Z0-9]/g, "");
  return (compact.slice(-6) || "unknown").toUpperCase();
}
