import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import * as vscode from "vscode";
import {
  CodexAppServerClient,
  type CodexThreadSnapshot,
  type CodexTurnCompletedEvent
} from "./codexAppServerClient";
import { getCodexExecutablePathFromExtension } from "./codexExtension";
import {
  formatChatCompletion,
  getCompletionActionLabel,
  isValidCodexThreadId,
  getCompletionNotificationPlan
} from "./chatNotifications";
import { getSettings } from "./config";
import { buildUnavailableStatusTooltip, formatStatus } from "./format";
import { normalizeSettingUpdate, renderSettingsView } from "./settingsView";
import {
  isPairingArtifactExpired,
  redactRemoteControlSecrets,
  type RemoteControlClientDevice,
  type RemoteControlPairingArtifact,
  type RemoteControlStatusSnapshot
} from "./remoteControl";
import type { ExtensionSettings, NormalizedUsageSnapshot } from "./types";
import { selectEarliestExpiringResetCredit, UsageService } from "./usageService";
import { evaluateUsageAlerts, formatUsageAlertMessage, type UsageAlert } from "./usageNotifications";

const THREAD_COMPLETION_POLL_LIMIT = 8;
const REMOTE_CONTROL_CONNECT_ATTEMPTS = 20;
const REMOTE_CONTROL_CONNECT_DELAY_MS = 500;
const REMOTE_CONTROL_PAIRING_POLL_MS = 3000;

let client: CodexAppServerClient | null = null;
let usageService: UsageService | null = null;
let clientSetupError: Error | null = null;
let statusItem: vscode.StatusBarItem;
let settingsPanel: vscode.WebviewPanel | null = null;
let output: vscode.OutputChannel;
let refreshTimer: NodeJS.Timeout | null = null;
let remotePairingTimer: NodeJS.Timeout | null = null;
let latestSnapshot: NormalizedUsageSnapshot | null = null;
let latestUsageError: string | null = null;
let settings: ExtensionSettings;
const notifiedTurns = new Set<string>();
const notifiedInputRequests = new Set<string>();
const recentThreads = new Map<string, CodexThreadSnapshot>();
let activeUsageAlertKeys = new Set<string>();
let threadCompletionPollBootstrapped = false;
let threadCompletionPollInFlight = false;
let threadCompletionPollErrorLogged = false;
let fallbackTurnNotificationSequence = 0;
let remoteControlSupported = true;
let remoteControlBusy = false;
let remoteControlPollInFlight = false;
let remotePairingPollInFlight = false;
let remoteControlStatus: RemoteControlStatusSnapshot | null = null;
let lastRemoteControlEnvironmentId: string | null = null;
let remoteControlPairing: RemoteControlPairingArtifact | null = null;
let remoteControlClients: RemoteControlClientDevice[] = [];
let remoteControlError: string | null = null;

export function activate(context: vscode.ExtensionContext): void {
  output = vscode.window.createOutputChannel("Codex Companion");
  statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 98);
  statusItem.command = "codexUsage.openSettings";
  context.subscriptions.push(output, statusItem);

  settings = getSettings();
  createClient();
  registerCommands(context);
  void syncRemoteControlSetting();

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (!event.affectsConfiguration("codexUsage")) {
        return;
      }

      const previousExecutable = settings.codexExecutable;
      const previousExecutableSource = settings.codexExecutableSource;
      const previousTimeout = settings.requestTimeoutMs;
      const previousRemoteControlEnabled = settings.remoteControlEnabled;
      settings = getSettings();

      if (
        previousExecutable !== settings.codexExecutable ||
        previousExecutableSource !== settings.codexExecutableSource ||
        previousTimeout !== settings.requestTimeoutMs
      ) {
        createClient();
        void syncRemoteControlSetting();
      } else if (
        previousRemoteControlEnabled !== settings.remoteControlEnabled &&
        !remoteControlBusy
      ) {
        void syncRemoteControlSetting();
      }

      schedulePolling();
      renderSettingsPanel();
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
  if (remotePairingTimer) {
    clearInterval(remotePairingTimer);
    remotePairingTimer = null;
  }
  client?.dispose();
}

function registerCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("codexUsage.refresh", async () => {
      await refreshUsage(true);
    }),
    vscode.commands.registerCommand("codexUsage.showDetails", async () => {
      openSettingsPanel(context);
    }),
    vscode.commands.registerCommand("codexUsage.restartAppServer", async () => {
      await restartAppServer();
    }),
    vscode.commands.registerCommand("codexUsage.resetUsage", async () => {
      await resetUsage();
    }),
    vscode.commands.registerCommand("codexUsage.openSettings", async () => {
      openSettingsPanel(context);
    }),
    vscode.commands.registerCommand("codexUsage.openLogs", () => {
      output.show();
    }),
    vscode.commands.registerCommand("codexUsage.openRemoteControl", async () => {
      openSettingsPanel(context);
      await refreshRemoteControl();
    })
  );
}

function createClient(): void {
  client?.dispose();
  client = null;
  usageService = null;
  clientSetupError = null;

  let executable: string;
  try {
    executable = resolveCodexExecutable();
  } catch (error) {
    clientSetupError = error instanceof Error ? error : new Error(String(error));
    output.appendLine(`Codex executable setup failed: ${clientSetupError.message}`);
    return;
  }

  output.appendLine(`Using Codex executable: ${executable}`);
  client = new CodexAppServerClient(executable, settings.requestTimeoutMs, output, {
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
        message
      );
    },
    onRemoteControlStatusChanged: (status) => {
      applyRemoteControlStatus(status);
      remoteControlSupported = true;
      remoteControlError = null;
      renderSettingsPanel();
      if (status.environmentId) {
        void refreshRemoteControlClients(status.environmentId).catch((error) => {
          setRemoteControlError(error);
          renderSettingsPanel();
        });
      }
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
    if (settings.remoteControlEnabled || settingsPanel) {
      void refreshRemoteControl();
    }
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
    latestUsageError = null;
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
    renderSettingsPanel();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    latestUsageError = message;
    output.appendLine(`Refresh failed: ${message}`);
    statusItem.text = "$(warning) Codex usage unavailable";
    statusItem.tooltip = buildUnavailableStatusTooltip(message);
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

    renderSettingsPanel();
  }
}

function resolveCodexExecutable(): string {
  if (settings.codexExecutableSource === "path") {
    return settings.codexExecutable;
  }

  return getCodexExecutablePathFromExtension();
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
  void showCompletionNotification("Codex chat complete", presentation.message, event.threadId);
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

  void showUsageAlert(evaluation.alerts);
}

async function showUsageAlert(alerts: UsageAlert[]): Promise<void> {
  await showNotification(
    "warning",
    alerts.some((alert) => alert.kind === "limit") ? "Codex usage limit reached" : "Codex usage warning",
    formatUsageAlertMessage(alerts)
  );
}

async function restartAppServer(): Promise<void> {
  statusItem.text = "$(sync~spin) Codex restarting...";
  latestSnapshot = null;
  latestUsageError = null;
  renderSettingsPanel();

  try {
    await client?.restart();
    await syncRemoteControlSetting();
    await refreshUsage(true);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    latestUsageError = message;
    output.appendLine(`Restart failed: ${message}`);
    vscode.window.showErrorMessage(`Codex app-server restart failed: ${message}`);
    renderSettingsPanel();
  }
}

async function resetUsage(): Promise<void> {
  if (!usageService) {
    createClient();
  }

  const availableCount = latestSnapshot?.resetCredits?.availableCount ?? 0;
  if (availableCount <= 0) {
    vscode.window.showInformationMessage("Codex reported no reset credits available.");
    renderSettingsPanel();
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
    renderSettingsPanel();
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
    renderSettingsPanel();
  }
}

async function syncRemoteControlSetting(): Promise<void> {
  if (!client || remoteControlBusy) {
    return;
  }

  remoteControlBusy = true;
  renderSettingsPanel();

  try {
    let status = await client.getRemoteControlStatus();
    if (settings.remoteControlEnabled && status.status !== "connected" && status.status !== "connecting") {
      status = await client.enableRemoteControl();
      output.appendLine("Remote control enabled.");
    } else if (!settings.remoteControlEnabled && status.status !== "disabled") {
      status = await client.disableRemoteControl();
      remoteControlPairing = null;
      clearRemotePairingTimer();
      output.appendLine("Remote control disabled.");
    }

    applyRemoteControlStatus(status);
    remoteControlSupported = true;
    remoteControlError = null;
    if (status.environmentId) {
      await refreshRemoteControlClients(status.environmentId);
    }
  } catch (error) {
    setRemoteControlError(error);
  } finally {
    remoteControlBusy = false;
    renderSettingsPanel();
  }
}

async function refreshRemoteControl(showToast = false): Promise<void> {
  if (!client || remoteControlPollInFlight) {
    return;
  }

  remoteControlPollInFlight = true;
  try {
    const status = await client.getRemoteControlStatus();
    applyRemoteControlStatus(status);
    remoteControlSupported = true;
    remoteControlError = null;
    if (status.environmentId) {
      await refreshRemoteControlClients(status.environmentId);
    }
    if (showToast) {
      vscode.window.setStatusBarMessage(`Codex remote control: ${status.status}.`, 3000);
    }
  } catch (error) {
    setRemoteControlError(error);
    if (showToast) {
      vscode.window.showErrorMessage(`Could not refresh Codex remote control: ${remoteControlError}`);
    }
  } finally {
    remoteControlPollInFlight = false;
    renderSettingsPanel();
  }
}

async function enableAndPairRemoteControl(): Promise<void> {
  if (!client || remoteControlBusy) {
    return;
  }

  remoteControlBusy = true;
  remoteControlError = null;
  renderSettingsPanel();

  try {
    if (!settings.remoteControlEnabled) {
      await vscode.workspace
        .getConfiguration("codexUsage")
        .update("remoteControlEnabled", true, vscode.ConfigurationTarget.Global);
      settings = getSettings();
    }

    let status = await client.enableRemoteControl();
    applyRemoteControlStatus(status);
    output.appendLine("Remote control enabled.");
    status = await waitForRemoteControlConnection(status);

    if (status.status !== "connected") {
      throw new Error(
        status.status === "errored"
          ? "Codex could not connect to the remote-control relay."
          : "Codex remote control did not connect before the pairing request timed out."
      );
    }

    remoteControlPairing = await client.startRemoteControlPairing();
    lastRemoteControlEnvironmentId = remoteControlPairing.environmentId;
    remoteControlSupported = true;
    remoteControlError = null;
    output.appendLine(
      `Remote control pairing code created; expires ${new Date(remoteControlPairing.expiresAt * 1000).toISOString()}.`
    );
    scheduleRemotePairingPoll();
    await refreshRemoteControlClients(remoteControlPairing.environmentId);
    vscode.window.showInformationMessage(
      "Codex remote-control pairing code is ready. Copy it from Codex Companion into ChatGPT Remote."
    );
  } catch (error) {
    setRemoteControlError(error);
    vscode.window.showErrorMessage(`Could not create a Codex remote-control pairing code: ${remoteControlError}`);
  } finally {
    remoteControlBusy = false;
    renderSettingsPanel();
  }
}

async function disableRemoteControl(): Promise<void> {
  if (!client || remoteControlBusy) {
    return;
  }

  const confirmation = await vscode.window.showWarningMessage(
    "Disable Codex remote control on this computer? Existing device grants are retained until revoked.",
    { modal: true },
    "Disable Remote Control"
  );
  if (confirmation !== "Disable Remote Control") {
    return;
  }

  remoteControlBusy = true;
  renderSettingsPanel();

  try {
    await vscode.workspace
      .getConfiguration("codexUsage")
      .update("remoteControlEnabled", false, vscode.ConfigurationTarget.Global);
    settings = getSettings();
    applyRemoteControlStatus(await client.disableRemoteControl());
    remoteControlPairing = null;
    clearRemotePairingTimer();
    remoteControlError = null;
    output.appendLine("Remote control disabled.");
  } catch (error) {
    setRemoteControlError(error);
    vscode.window.showErrorMessage(`Could not disable Codex remote control: ${remoteControlError}`);
  } finally {
    remoteControlBusy = false;
    renderSettingsPanel();
  }
}

async function copyRemoteControlPairingCode(): Promise<void> {
  if (!remoteControlPairing || isPairingArtifactExpired(remoteControlPairing)) {
    remoteControlPairing = null;
    clearRemotePairingTimer();
    renderSettingsPanel();
    vscode.window.showWarningMessage("That remote-control pairing code has expired. Create a new code.");
    return;
  }

  await vscode.env.clipboard.writeText(remoteControlPairing.manualPairingCode);
  vscode.window.setStatusBarMessage("Codex remote-control pairing code copied.", 3000);
}

async function revokeRemoteControlClient(clientId: unknown): Promise<void> {
  if (!client || remoteControlBusy || typeof clientId !== "string") {
    return;
  }

  const device = remoteControlClients.find((candidate) => candidate.clientId === clientId);
  if (!device) {
    vscode.window.showErrorMessage("That paired device is no longer available.");
    return;
  }

  const environmentId = remoteControlStatus?.environmentId ?? lastRemoteControlEnvironmentId;
  if (!environmentId) {
    vscode.window.showErrorMessage("Re-enable remote control before managing paired devices.");
    return;
  }

  const name = device.displayName ?? device.deviceModel ?? device.deviceType ?? "this device";
  const confirmation = await vscode.window.showWarningMessage(
    `Revoke Codex remote-control access for ${name}?`,
    { modal: true },
    "Revoke Device"
  );
  if (confirmation !== "Revoke Device") {
    return;
  }

  remoteControlBusy = true;
  renderSettingsPanel();
  try {
    await client.revokeRemoteControlClient(environmentId, clientId);
    remoteControlClients = remoteControlClients.filter((candidate) => candidate.clientId !== clientId);
    remoteControlError = null;
    output.appendLine("Remote controller device revoked.");
  } catch (error) {
    setRemoteControlError(error);
    vscode.window.showErrorMessage(`Could not revoke the remote-control device: ${remoteControlError}`);
  } finally {
    remoteControlBusy = false;
    renderSettingsPanel();
  }
}

async function refreshRemoteControlClients(environmentId: string): Promise<void> {
  if (!client) {
    return;
  }

  const response = await client.listRemoteControlClients(environmentId);
  remoteControlClients = response.data;
  lastRemoteControlEnvironmentId = environmentId;
}

async function waitForRemoteControlConnection(
  initialStatus: RemoteControlStatusSnapshot
): Promise<RemoteControlStatusSnapshot> {
  let status = initialStatus;
  for (let attempt = 0; attempt < REMOTE_CONTROL_CONNECT_ATTEMPTS; attempt += 1) {
    if (status.status !== "connecting") {
      return status;
    }
    await delay(REMOTE_CONTROL_CONNECT_DELAY_MS);
    status = await client!.getRemoteControlStatus();
    applyRemoteControlStatus(status);
    renderSettingsPanel();
  }
  return status;
}

function scheduleRemotePairingPoll(): void {
  clearRemotePairingTimer();
  remotePairingTimer = setInterval(() => {
    void pollRemoteControlPairing();
  }, REMOTE_CONTROL_PAIRING_POLL_MS);
}

async function pollRemoteControlPairing(): Promise<void> {
  if (!client || !remoteControlPairing || remotePairingPollInFlight) {
    return;
  }

  if (isPairingArtifactExpired(remoteControlPairing)) {
    remoteControlPairing = null;
    clearRemotePairingTimer();
    renderSettingsPanel();
    return;
  }

  remotePairingPollInFlight = true;
  try {
    const claimed = await client.isRemoteControlPairingClaimed(remoteControlPairing.pairingCode);
    if (!claimed) {
      return;
    }

    const environmentId = remoteControlPairing.environmentId;
    remoteControlPairing = null;
    clearRemotePairingTimer();
    await refreshRemoteControlClients(environmentId);
    output.appendLine("Remote controller device paired.");
    vscode.window.showInformationMessage("ChatGPT Remote is now paired with this computer.");
    renderSettingsPanel();
  } catch (error) {
    setRemoteControlError(error);
    clearRemotePairingTimer();
    renderSettingsPanel();
  } finally {
    remotePairingPollInFlight = false;
  }
}

function clearRemotePairingTimer(): void {
  if (remotePairingTimer) {
    clearInterval(remotePairingTimer);
    remotePairingTimer = null;
  }
}

function applyRemoteControlStatus(status: RemoteControlStatusSnapshot): void {
  remoteControlStatus = status;
  if (status.environmentId) {
    lastRemoteControlEnvironmentId = status.environmentId;
  }
}

function setRemoteControlError(error: unknown): void {
  const message = redactRemoteControlSecrets(
    error instanceof Error ? error.message : String(error),
    [
      remoteControlPairing?.pairingCode,
      remoteControlPairing?.manualPairingCode,
      remoteControlPairing?.environmentId,
      remoteControlStatus?.installationId,
      remoteControlStatus?.environmentId,
      lastRemoteControlEnvironmentId,
      ...remoteControlClients.map((client) => client.clientId)
    ]
  );
  const unsupported = /method not found|unknown method|unsupported.*remote.?control/i.test(message);
  remoteControlSupported = !unsupported;
  remoteControlError = unsupported
    ? "This Codex executable does not support remote control. Update Codex or select the newer bundled executable."
    : message;
  output.appendLine(`Remote control failed: ${remoteControlError}`);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function openSettingsPanel(context: vscode.ExtensionContext): void {
  if (settingsPanel) {
    settingsPanel.reveal(vscode.ViewColumn.Active);
    renderSettingsPanel();
    void refreshUsage();
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    "codexUsage.settings",
    "Codex Companion",
    vscode.ViewColumn.Active,
    {
      enableScripts: true,
      retainContextWhenHidden: true
    }
  );
  settingsPanel = panel;
  context.subscriptions.push(panel);

  const panelDisposables: vscode.Disposable[] = [];
  panel.webview.onDidReceiveMessage(
    async (message: unknown) => {
      await handleSettingsMessage(panel, message);
    },
    undefined,
    panelDisposables
  );
  panel.onDidDispose(() => {
    settingsPanel = null;
    for (const disposable of panelDisposables) {
      disposable.dispose();
    }
  });

  renderSettingsPanel();
  void refreshUsage();
}

async function handleSettingsMessage(panel: vscode.WebviewPanel, message: unknown): Promise<void> {
  if (!message || typeof message !== "object") {
    return;
  }

  const payload = message as {
    type?: unknown;
    command?: unknown;
    clientId?: unknown;
    key?: unknown;
    value?: unknown;
  };

  if (payload.type === "command") {
    switch (payload.command) {
      case "refresh":
        await refreshUsage();
        return;
      case "restart":
        await restartAppServer();
        return;
      case "logs":
        output.show();
        return;
      case "reset":
        await resetUsage();
        return;
      case "remotePair":
        await enableAndPairRemoteControl();
        return;
      case "remoteRefresh":
        await refreshRemoteControl(true);
        return;
      case "remoteDisable":
        await disableRemoteControl();
        return;
      case "remoteCopyPairingCode":
        await copyRemoteControlPairingCode();
        return;
      case "remoteRevoke":
        await revokeRemoteControlClient(payload.clientId);
        return;
      default:
        return;
    }
  }

  if (payload.type !== "updateSetting") {
    return;
  }

  const update = normalizeSettingUpdate(payload.key, payload.value);
  if (!update) {
    await panel.webview.postMessage({
      type: "settingError",
      message: "That setting value is invalid."
    });
    return;
  }

  try {
    await vscode.workspace
      .getConfiguration("codexUsage")
      .update(update.key, update.value, vscode.ConfigurationTarget.Global);
    await panel.webview.postMessage({ type: "settingSaved" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    output.appendLine(`Setting update failed: ${message}`);
    await panel.webview.postMessage({
      type: "settingError",
      message: "Setting could not be saved."
    });
  }
}

function renderSettingsPanel(): void {
  if (!settingsPanel) {
    return;
  }

  settingsPanel.webview.html = renderSettingsView({
    cspSource: settingsPanel.webview.cspSource,
    nonce: randomBytes(18).toString("base64"),
    settings,
    snapshot: latestSnapshot,
    errorMessage: latestUsageError,
    remoteControl: {
      supported: remoteControlSupported,
      busy: remoteControlBusy,
      status: remoteControlStatus,
      pairing: remoteControlPairing,
      clients: remoteControlClients,
      errorMessage: remoteControlError
    }
  });
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
): Promise<void> {
  const wantsNative = settings.notificationMode === "native" || settings.notificationMode === "both";
  const nativeDelivered = wantsNative ? await showNativeNotification(kind, title, message) : false;
  const wantsVscode =
    settings.notificationMode === "vscode" ||
    settings.notificationMode === "both" ||
    !nativeDelivered;

  if (wantsVscode) {
    await showVscodeNotification(kind, message);
  }
}

function showVscodeNotification(
  kind: "info" | "warning",
  message: string,
): Thenable<string | undefined> {
  if (kind === "warning") {
    return vscode.window.showWarningMessage(message);
  }

  return vscode.window.showInformationMessage(message);
}

async function showCompletionNotification(title: string, message: string, threadId: string): Promise<void> {
  const plan = getCompletionNotificationPlan(vscode.window.state.focused, settings.notificationMode);
  const actionLabel = getCompletionActionLabel(settings.completionChatAction);
  const nativeDelivered = plan.native
    ? await showNativeCompletionNotification(title, message, actionLabel, threadId)
    : false;

  if (plan.vscode || (plan.native && !nativeDelivered)) {
    const selection = actionLabel
      ? await vscode.window.showInformationMessage(message, actionLabel)
      : await vscode.window.showInformationMessage(message);
    if (selection === actionLabel) {
      await openCompletedChat(threadId);
    }
  }
}

async function openCompletedChat(threadId: string): Promise<void> {
  if (settings.completionChatAction === "none") {
    return;
  }

  if (settings.completionChatAction === "sidebar" || !isValidCodexThreadId(threadId)) {
    await openCodexSidebar();
    return;
  }

  try {
    const codexExtension = vscode.extensions.getExtension("openai.chatgpt");
    if (!codexExtension) {
      throw new Error("The OpenAI Codex extension is not installed.");
    }
    await codexExtension.activate();
    const resource = vscode.Uri.from({
      scheme: "openai-codex",
      authority: "route",
      path: `/local/${threadId}`
    });
    await vscode.commands.executeCommand("vscode.open", resource, {
      preview: false,
      preserveFocus: false
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    output.appendLine(`Exact chat navigation failed: ${message}`);
    vscode.window.showWarningMessage(
      "The exact Codex chat could not be opened. Opening the Codex sidebar instead."
    );
    await openCodexSidebar();
  }
}

async function openCodexSidebar(): Promise<void> {
  try {
    await vscode.commands.executeCommand("chatgpt.openSidebar");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    output.appendLine(`Codex sidebar navigation failed: ${message}`);
    vscode.window.showWarningMessage("Could not open the Codex sidebar. Is the OpenAI Codex extension installed?");
  }
}

function showNativeCompletionNotification(
  title: string,
  message: string,
  actionLabel: string | null,
  threadId: string
): Promise<boolean> {
  if (process.platform !== "linux") {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    let settled = false;
    const args = [
      "--app-name=Codex Companion",
      "--icon=code",
      "--urgency=normal"
    ];
    if (actionLabel) {
      args.push(`--action=default=${actionLabel}`);
    }
    args.push(title, message);

    const proc = spawn("notify-send", args, {
      stdio: ["ignore", actionLabel ? "pipe" : "ignore", "ignore"],
      detached: true
    });

    proc.once("spawn", () => {
      settled = true;
      resolve(true);
    });
    proc.once("error", (error) => {
      output.appendLine(`Native completion notification failed: ${error.message}`);
      if (!settled) {
        settled = true;
        resolve(false);
      }
    });
    proc.once("exit", (code) => {
      if (code !== 0) {
        output.appendLine(`Native completion notification failed with exit code ${code ?? "unknown"}.`);
      }
    });
    proc.stdout?.on("data", (chunk: Buffer) => {
      if (chunk.toString().trim() === "default") {
        void openCompletedChat(threadId);
      }
    });

    proc.unref();
  });
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
        "--app-name=Codex Companion",
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
