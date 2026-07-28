import { spawn } from "node:child_process";
import * as vscode from "vscode";
import {
  CodexAppServerClient,
  type CodexThreadSnapshot,
  type CodexTurnCompletedEvent
} from "./codexAppServerClient";
import { buildCodexIdeChatUri, formatChatCompletion } from "./chatNotifications";
import { getSettings } from "./config";
import { buildUsageQuickPickItems, formatStatus } from "./format";
import type { ExtensionSettings, NormalizedUsageSnapshot } from "./types";
import { selectEarliestExpiringResetCredit, UsageService } from "./usageService";
import { evaluateUsageAlerts, formatUsageAlertMessage, type UsageAlert } from "./usageNotifications";

const THREAD_COMPLETION_POLL_LIMIT = 8;

let client: CodexAppServerClient | null = null;
let usageService: UsageService | null = null;
let statusItem: vscode.StatusBarItem;
let output: vscode.OutputChannel;
let refreshTimer: NodeJS.Timeout | null = null;
let latestSnapshot: NormalizedUsageSnapshot | null = null;
let settings: ExtensionSettings;
const notifiedTurns = new Set<string>();
const notifiedInputRequests = new Set<string>();
const recentThreads = new Map<string, CodexThreadSnapshot>();
let activeUsageAlertKeys = new Set<string>();
let threadCompletionPollBootstrapped = false;
let threadCompletionPollInFlight = false;
let threadCompletionPollErrorLogged = false;
let fallbackTurnNotificationSequence = 0;

export function activate(context: vscode.ExtensionContext): void {
  output = vscode.window.createOutputChannel("Codex Usage Status");
  statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 98);
  statusItem.command = "codexUsage.showDetails";
  context.subscriptions.push(output, statusItem);

  settings = getSettings();
  createClient();
  registerCommands(context);

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (!event.affectsConfiguration("codexUsage")) {
        return;
      }

      const previousExecutable = settings.codexExecutable;
      const previousTimeout = settings.requestTimeoutMs;
      settings = getSettings();

      if (previousExecutable !== settings.codexExecutable || previousTimeout !== settings.requestTimeoutMs) {
        createClient();
      }

      schedulePolling();
      void refreshUsage();
      void pollThreadCompletions();
    })
  );

  statusItem.text = "$(sync~spin) Codex refreshing...";
  statusItem.show();
  schedulePolling();
  void refreshUsage();
  void pollThreadCompletions();
}

export function deactivate(): void {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
  client?.dispose();
}

function registerCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("codexUsage.refresh", async () => {
      await refreshUsage(true);
    }),
    vscode.commands.registerCommand("codexUsage.showDetails", async () => {
      await showDetails();
    }),
    vscode.commands.registerCommand("codexUsage.restartAppServer", async () => {
      await restartAppServer();
    }),
    vscode.commands.registerCommand("codexUsage.resetUsage", async () => {
      await resetUsage();
    }),
    vscode.commands.registerCommand("codexUsage.openSettings", async () => {
      await vscode.commands.executeCommand("workbench.action.openSettings", "@ext:thiscommonuser.codex-usage-status");
    })
  );
}

function createClient(): void {
  client?.dispose();
  client = new CodexAppServerClient(settings.codexExecutable, settings.requestTimeoutMs, output, {
    onRateLimitsUpdated: () => {
      void refreshUsage();
    },
    onTurnCompleted: (event) => {
      notifyTurnCompleted(event);
    },
    onNeedsUserInput: (event) => {
      if (!settings.notifyNeedsInput) {
        return;
      }

      const key = `${event.method}:${event.threadId ?? "unknown"}:${event.turnId ?? "unknown"}:${event.title}`;
      if (notifiedInputRequests.has(key)) {
        return;
      }
      notifiedInputRequests.add(key);

      const message = event.detail ? `${event.title}: ${event.detail}` : event.title;
      void showNotification(
        "warning",
        "Codex needs input",
        message,
        ["Go to Chat", "Show Usage"],
        true
      ).then((action) => {
        if (action === "Go to Chat") {
          void openCodexChat(event.threadId);
        } else if (action === "Show Usage") {
          void showDetails();
        }
      });
    }
  });
  usageService = new UsageService(client);
}

function schedulePolling(): void {
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }

  const intervalMs = Math.max(5, settings.refreshIntervalSeconds) * 1000;
  refreshTimer = setInterval(() => {
    void refreshUsage();
    void pollThreadCompletions();
  }, intervalMs);
}

async function refreshUsage(showToast = false): Promise<void> {
  if (!usageService) {
    createClient();
  }

  statusItem.text = latestSnapshot ? statusItem.text : "$(sync~spin) Codex refreshing...";
  statusItem.show();

  try {
    latestSnapshot = await usageService!.readUsage();
    const presentation = formatStatus(latestSnapshot, settings);
    statusItem.text = presentation.text;
    statusItem.tooltip = presentation.tooltip;
    statusItem.color = presentation.color;
    statusItem.backgroundColor = presentation.backgroundColor;
    statusItem.accessibilityInformation = {
      label: presentation.accessibilityLabel,
      role: "button"
    };
    statusItem.show();

    if (showToast) {
      vscode.window.setStatusBarMessage("Codex usage refreshed.", 2500);
    }

    notifyUsageWarnings(latestSnapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    output.appendLine(`Refresh failed: ${message}`);
    statusItem.text = "$(warning) Codex usage unavailable";
    statusItem.tooltip = `Codex Usage Status could not read account usage.\n\n${message}`;
    statusItem.color = new vscode.ThemeColor("statusBarItem.errorForeground");
    statusItem.backgroundColor = new vscode.ThemeColor("statusBarItem.errorBackground");
    statusItem.accessibilityInformation = {
      label: "Codex usage unavailable",
      role: "button"
    };
    statusItem.show();

    if (showToast) {
      const selection = await vscode.window.showWarningMessage(
        `Codex usage unavailable: ${message}`,
        "Show Logs",
        "Restart App Server"
      );
      if (selection === "Show Logs") {
        output.show();
      } else if (selection === "Restart App Server") {
        await restartAppServer();
      }
    }
  }
}

async function pollThreadCompletions(): Promise<void> {
  if (!settings.notifyTurnComplete) {
    threadCompletionPollBootstrapped = false;
    return;
  }

  if (!client || threadCompletionPollInFlight) {
    return;
  }

  threadCompletionPollInFlight = true;
  const shouldNotify = threadCompletionPollBootstrapped;

  try {
    const threadSummaries = await client.listRecentThreads(THREAD_COMPLETION_POLL_LIMIT);
    recentThreads.clear();

    for (const summary of threadSummaries) {
      recentThreads.set(summary.id, summary);
    }

    for (const summary of threadSummaries) {
      if (summary.source && summary.source !== "vscode") {
        continue;
      }

      const thread = await client.readThread(summary.id);
      if (!thread) {
        continue;
      }

      for (const turn of thread.turns) {
        if (turn.completedAt === null) {
          continue;
        }

        notifyTurnCompleted(
          {
            threadId: thread.id,
            turnId: turn.id,
            status: turn.status,
            durationMs: turn.durationMs,
            completedAt: turn.completedAt,
            threadName: summary.name,
            cwd: summary.cwd,
            gitBranch: summary.gitBranch,
            source: summary.source
          },
          shouldNotify
        );
      }
    }

    threadCompletionPollBootstrapped = true;
    threadCompletionPollErrorLogged = false;
  } catch (error) {
    if (!threadCompletionPollErrorLogged) {
      const message = error instanceof Error ? error.message : String(error);
      output.appendLine(`Thread completion polling unavailable: ${message}`);
      threadCompletionPollErrorLogged = true;
    }
  } finally {
    threadCompletionPollInFlight = false;
  }
}

function notifyTurnCompleted(event: CodexTurnCompletedEvent, showToast = true): void {
  if (!settings.notifyTurnComplete) {
    return;
  }

  const key = getTurnNotificationKey(event);
  if (notifiedTurns.has(key)) {
    return;
  }
  notifiedTurns.add(key);

  if (!showToast) {
    return;
  }

  const summary = recentThreads.get(event.threadId);
  const enrichedEvent: CodexTurnCompletedEvent = {
    ...event,
    threadName: event.threadName ?? summary?.name ?? null,
    cwd: event.cwd ?? summary?.cwd ?? null,
    gitBranch: event.gitBranch ?? summary?.gitBranch ?? null,
    source: event.source ?? summary?.source ?? null
  };
  const presentation = formatChatCompletion(
    enrichedEvent,
    typeof event.durationMs === "number" ? formatDuration(event.durationMs) : null
  );

  void showVscodeNotification(
    "info",
    presentation.message,
    ["Go to Chat", "Show Usage"]
  ).then((action) => {
    if (action === "Go to Chat") {
      void openCodexChat(event.threadId);
    } else if (action === "Show Usage") {
      void showDetails();
    }
  });
}

function getTurnNotificationKey(event: CodexTurnCompletedEvent): string {
  if (event.turnId) {
    return `${event.threadId}:${event.turnId}`;
  }

  if (event.completedAt !== null) {
    return `${event.threadId}:completed:${event.completedAt}`;
  }

  fallbackTurnNotificationSequence += 1;
  return `${event.threadId}:event:${Date.now()}:${fallbackTurnNotificationSequence}`;
}

function notifyUsageWarnings(snapshot: NormalizedUsageSnapshot): void {
  if (!settings.notifyUsageWarnings) {
    activeUsageAlertKeys.clear();
    return;
  }

  const evaluation = evaluateUsageAlerts(snapshot, settings.warnAtPercent, activeUsageAlertKeys);
  activeUsageAlertKeys = evaluation.activeKeys;

  if (evaluation.alerts.length === 0) {
    return;
  }

  void showUsageAlert(evaluation.alerts, snapshot);
}

async function showUsageAlert(alerts: UsageAlert[], snapshot: NormalizedUsageSnapshot): Promise<void> {
  const actions = ["Show Usage"];
  if ((snapshot.resetCredits?.availableCount ?? 0) > 0) {
    actions.push("Use Reset Credit");
  }

  const action = await showNotification(
    "warning",
    alerts.some((alert) => alert.kind === "limit") ? "Codex usage limit reached" : "Codex usage warning",
    formatUsageAlertMessage(alerts),
    actions,
    true
  );

  if (action === "Show Usage") {
    await showDetails();
  } else if (action === "Use Reset Credit") {
    await resetUsage();
  }
}

async function showDetails(): Promise<void> {
  if (!latestSnapshot) {
    await refreshUsage(true);
  }

  if (!latestSnapshot) {
    return;
  }

  const action = await vscode.window.showQuickPick(buildUsageQuickPickItems(latestSnapshot, settings), {
    title: "Codex Usage",
    placeHolder: "Select an action, or inspect a usage bucket.",
    matchOnDescription: true,
    matchOnDetail: true
  });

  if (action?.action === "refresh") {
    await refreshUsage(true);
  } else if (action?.action === "openLogs") {
    output.show();
  } else if (action?.action === "resetUsage") {
    await resetUsage();
  }
}

async function restartAppServer(): Promise<void> {
  statusItem.text = "$(sync~spin) Codex restarting...";
  latestSnapshot = null;

  try {
    await client?.restart();
    await refreshUsage(true);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    output.appendLine(`Restart failed: ${message}`);
    vscode.window.showErrorMessage(`Codex app-server restart failed: ${message}`);
  }
}

async function resetUsage(): Promise<void> {
  if (!usageService) {
    createClient();
  }

  const availableCount = latestSnapshot?.resetCredits?.availableCount ?? 0;
  if (availableCount <= 0) {
    vscode.window.showInformationMessage("Codex reported no reset credits available.");
    return;
  }

  const selectedCredit = selectEarliestExpiringResetCredit(latestSnapshot?.resetCredits);
  const selectionDetail =
    selectedCredit?.expiresAt !== null && selectedCredit?.expiresAt !== undefined
      ? ` The available credit expiring ${new Date(selectedCredit.expiresAt * 1000).toLocaleString()} will be used first.`
      : selectedCredit
        ? " A non-expiring credit will be used because no expiring credit is available."
        : " Codex will choose the credit because per-credit IDs are unavailable.";
  const confirmation = await vscode.window.showWarningMessage(
    `Use one Codex reset credit? You currently have ${availableCount} available.${selectionDetail}`,
    { modal: true },
    "Use Reset Credit"
  );

  if (confirmation !== "Use Reset Credit") {
    return;
  }

  try {
    const outcome = await usageService!.consumeResetCredit(selectedCredit?.id);
    output.appendLine(`Reset credit outcome: ${outcome}`);

    const message = formatResetOutcome(outcome);
    await refreshUsage();
    vscode.window.showInformationMessage(message);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    output.appendLine(`Reset credit failed: ${message}`);
    vscode.window.showErrorMessage(`Could not use Codex reset credit: ${message}`);
  }
}

function formatResetOutcome(outcome: string): string {
  switch (outcome) {
    case "reset":
      return "Codex usage reset credit applied.";
    case "nothingToReset":
      return "Codex reported there was nothing to reset.";
    case "noCredit":
      return "Codex reported no reset credits available.";
    case "alreadyRedeemed":
      return "This reset attempt was already redeemed.";
    default:
      return `Codex reset credit result: ${outcome}`;
  }
}

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${seconds}s`;
}

async function showNotification(
  kind: "info" | "warning",
  title: string,
  message: string,
  actions: string[] = [],
  alwaysShowActions = false
): Promise<string | undefined> {
  const wantsNative = settings.notificationMode === "native" || settings.notificationMode === "both";
  const nativeDelivered = wantsNative ? await showNativeNotification(kind, title, message) : false;
  const wantsVscode =
    settings.notificationMode === "vscode" ||
    settings.notificationMode === "both" ||
    !nativeDelivered ||
    (alwaysShowActions && actions.length > 0);

  return wantsVscode ? showVscodeNotification(kind, message, actions) : undefined;
}

function showVscodeNotification(
  kind: "info" | "warning",
  message: string,
  actions: string[]
): Thenable<string | undefined> {
  if (kind === "warning") {
    return vscode.window.showWarningMessage(message, ...actions);
  }

  return vscode.window.showInformationMessage(message, ...actions);
}

function showNativeNotification(
  kind: "info" | "warning",
  title: string,
  message: string
): Promise<boolean> {
  if (process.platform !== "linux") {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    const proc = spawn(
      "notify-send",
      [
        "--app-name=Codex Usage Status",
        "--icon=code",
        "--urgency=normal",
        title,
        message
      ],
      {
        stdio: "ignore",
        detached: true
      }
    );

    proc.once("error", (error) => {
      output.appendLine(`Native notification failed: ${error.message}`);
      resolve(false);
    });

    proc.once("exit", (code) => {
      if (code === 0) {
        resolve(true);
      } else {
        output.appendLine(`Native notification failed with exit code ${code ?? "unknown"}.`);
        resolve(false);
      }
    });

    proc.unref();
  });
}

async function openCodexChat(threadId: string | null): Promise<void> {
  const codexExtension = vscode.extensions.getExtension("openai.chatgpt");
  if (!codexExtension) {
    await vscode.window.showWarningMessage(
      "The official Codex extension is not installed or enabled, so this chat cannot be opened."
    );
    return;
  }

  try {
    await codexExtension.activate();
    await vscode.commands.executeCommand("chatgpt.openSidebar");

    const chatUri = threadId ? buildCodexIdeChatUri(vscode.env.uriScheme, threadId) : null;
    if (!chatUri) {
      return;
    }

    const opened = await vscode.env.openExternal(vscode.Uri.parse(chatUri));
    if (!opened) {
      output.appendLine(`Codex did not accept the chat route for thread ${threadId}.`);
      await vscode.window.showWarningMessage(
        "Codex opened, but this version of the official extension could not navigate to the completed chat."
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    output.appendLine(`Could not open Codex chat ${threadId ?? "unknown"}: ${message}`);
    await vscode.window.showWarningMessage(`Could not open the completed Codex chat: ${message}`);
  }
}
