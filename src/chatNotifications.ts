import type { CodexTurnCompletedEvent } from "./codexAppServerClient";
import type { ExtensionSettings } from "./types";

const MAX_CHAT_NAME_LENGTH = 72;

export interface ChatCompletionPresentation {
  message: string;
}

export interface CompletionNotificationPlan {
  native: boolean;
  vscode: boolean;
}

export function getCompletionNotificationPlan(
  windowFocused: boolean,
  mode: ExtensionSettings["notificationMode"]
): CompletionNotificationPlan {
  return {
    native: !windowFocused && (mode === "native" || mode === "both"),
    vscode: windowFocused || mode === "vscode" || mode === "both"
  };
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
    message: `${chatName} completed${status}${duration}.${contextText}`
  };
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
