import {
  formatInteger,
  formatRecentDailyUsage,
  formatRecentTokenTotal,
  formatResetCreditExpiry,
  formatResetCreditType,
  formatResetTime,
  formatResetShort,
  formatWindowPercent
} from "./formatCore";
import type {
  ExtensionSettings,
  NormalizedUsageBucket,
  NormalizedUsageSnapshot,
  RateLimitResetCreditsSummary,
  RateLimitWindow
} from "./types";
import type {
  RemoteControlClientDevice,
  RemoteControlPairingArtifact,
  RemoteControlStatusSnapshot
} from "./remoteControl";

export interface RemoteControlViewState {
  supported: boolean;
  sharedHostSupported: boolean;
  busy: boolean;
  status: RemoteControlStatusSnapshot | null;
  pairing: RemoteControlPairingArtifact | null;
  clients: RemoteControlClientDevice[];
  errorMessage: string | null;
}

export interface SettingsViewState {
  cspSource: string;
  nonce: string;
  settings: ExtensionSettings;
  snapshot: NormalizedUsageSnapshot | null;
  errorMessage: string | null;
  focusRemoteControl?: boolean;
  remoteControl: RemoteControlViewState;
}

export interface NormalizedSettingUpdate {
  key: string;
  value: string | number | boolean;
}

export function normalizeSettingUpdate(key: unknown, value: unknown): NormalizedSettingUpdate | null {
  switch (key) {
    case "refreshIntervalSeconds":
      return normalizeNumberSetting(key, value, 5);
    case "warnAtPercent":
      return normalizeNumberSetting(key, value, 1, 100);
    case "requestTimeoutMs":
      return normalizeNumberSetting(key, value, 1000);
    case "codexExecutable":
      return typeof value === "string" && value.trim()
        ? { key, value: value.trim() }
        : null;
    case "showExtraBuckets":
    case "notifyUsageWarnings":
    case "notifyTurnComplete":
    case "notifyNeedsInput":
    case "remoteControlEnabled":
    case "sharedRemoteHostEnabled":
      return typeof value === "boolean" ? { key, value } : null;
    case "statusFormat":
      return value === "compact" || value === "remaining" ? { key, value } : null;
    case "notificationMode":
      return value === "native" || value === "vscode" || value === "both"
        ? { key, value }
        : null;
    case "completionChatAction":
      return value === "exact" || value === "sidebar" || value === "none"
        ? { key, value }
        : null;
    default:
      return null;
  }
}

export function renderSettingsView(state: SettingsViewState): string {
  const {
    cspSource,
    nonce,
    settings,
    snapshot,
    errorMessage,
    focusRemoteControl,
    remoteControl
  } = state;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${escapeAttribute(cspSource)} 'nonce-${escapeAttribute(nonce)}'; script-src 'nonce-${escapeAttribute(nonce)}';">
  <title>Codex Companion</title>
  <style nonce="${escapeAttribute(nonce)}">
    :root { color-scheme: light dark; }
    body {
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      margin: 0;
      padding: 0 28px 48px;
    }
    main { max-width: 960px; margin: 0 auto; }
    header {
      align-items: flex-start;
      border-bottom: 1px solid var(--vscode-panel-border);
      display: flex;
      gap: 20px;
      justify-content: space-between;
      padding: 28px 0 20px;
    }
    h1, h2, h3, p { margin-top: 0; }
    h1 { font-size: 24px; margin-bottom: 6px; }
    h2 { font-size: 18px; margin-bottom: 14px; }
    h3 { font-size: 14px; margin-bottom: 10px; }
    .muted, .description { color: var(--vscode-descriptionForeground); }
    .description { font-size: 12px; line-height: 1.45; margin: 6px 0 0; }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; }
    button {
      background: var(--vscode-button-background);
      border: 1px solid transparent;
      color: var(--vscode-button-foreground);
      cursor: pointer;
      font: inherit;
      padding: 6px 12px;
    }
    button:hover { background: var(--vscode-button-hoverBackground); }
    button.secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    button.secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
    button:disabled { cursor: default; opacity: 0.55; }
    section {
      border-bottom: 1px solid var(--vscode-panel-border);
      padding: 24px 0;
      scroll-margin-top: 16px;
    }
    .notice {
      background: var(--vscode-inputValidation-errorBackground);
      border: 1px solid var(--vscode-inputValidation-errorBorder);
      color: var(--vscode-inputValidation-errorForeground);
      margin-bottom: 18px;
      padding: 10px 12px;
    }
    .summary-grid, .bucket-grid, .settings-grid {
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
    }
    .card {
      background: var(--vscode-editorWidget-background);
      border: 1px solid var(--vscode-panel-border);
      padding: 14px;
    }
    .metric {
      display: block;
      font-size: 22px;
      font-weight: 600;
      margin: 4px 0;
    }
    .setting {
      border-top: 1px solid var(--vscode-panel-border);
      padding: 14px 0;
    }
    .setting:first-child { border-top: 0; padding-top: 0; }
    .setting label { display: block; font-weight: 600; margin-bottom: 7px; }
    .setting.checkbox label { align-items: center; display: flex; gap: 8px; }
    input[type="text"], input[type="number"], select {
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border, transparent);
      box-sizing: border-box;
      color: var(--vscode-input-foreground);
      font: inherit;
      max-width: 420px;
      padding: 6px 8px;
      width: 100%;
    }
    input:focus, select:focus, button:focus {
      outline: 1px solid var(--vscode-focusBorder);
      outline-offset: 1px;
    }
    dl {
      display: grid;
      grid-template-columns: minmax(100px, max-content) 1fr;
      margin: 0;
      row-gap: 6px;
    }
    dt { color: var(--vscode-descriptionForeground); }
    dd { margin: 0; overflow-wrap: anywhere; }
    .credit { margin-top: 12px; }
    pre {
      background: var(--vscode-textCodeBlock-background);
      font-family: var(--vscode-editor-font-family);
      font-size: 12px;
      margin: 10px 0 0;
      overflow: auto;
      padding: 10px;
      white-space: pre-wrap;
    }
    .reset-heading {
      align-items: center;
      display: flex;
      gap: 16px;
      justify-content: space-between;
    }
    .pair-code {
      font-family: var(--vscode-editor-font-family);
      font-size: 22px;
      font-weight: 600;
      letter-spacing: 0.08em;
      overflow-wrap: anywhere;
    }
    .device-row {
      align-items: center;
      border-top: 1px solid var(--vscode-panel-border);
      display: flex;
      gap: 16px;
      justify-content: space-between;
      padding: 12px 0;
    }
    .device-row:first-child { border-top: 0; padding-top: 0; }
    .device-row:last-child { padding-bottom: 0; }
    .device-row p { margin-bottom: 0; }
    #save-status {
      color: var(--vscode-descriptionForeground);
      min-height: 18px;
      padding-top: 8px;
    }
    @media (max-width: 640px) {
      body { padding-left: 16px; padding-right: 16px; }
      header, .reset-heading { display: block; }
      header .actions, .reset-heading button { margin-top: 14px; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>Codex Companion</h1>
        <p class="muted">Live usage, reset credits, remote access, and extension preferences in one place.</p>
      </div>
      <div class="actions" aria-label="Extension actions">
        <button type="button" data-command="refresh">Refresh</button>
        <button type="button" class="secondary" data-command="restart">Restart server</button>
        <button type="button" class="secondary" data-command="logs">Open logs</button>
      </div>
    </header>

    <section aria-labelledby="usage-heading">
      <h2 id="usage-heading">Usage</h2>
      ${renderUsage(snapshot, errorMessage, settings.showExtraBuckets)}
    </section>

    <section aria-labelledby="reset-heading">
      ${renderResetCredits(snapshot?.resetCredits ?? null)}
    </section>

    <section aria-labelledby="account-heading">
      <h2 id="account-heading">Account</h2>
      ${renderAccount(snapshot)}
    </section>

    <section id="remote-control" tabindex="-1" aria-labelledby="remote-control-heading">
      <h2 id="remote-control-heading">Remote control</h2>
      ${renderRemoteControl(
        remoteControl,
        settings.remoteControlEnabled,
        settings.sharedRemoteHostEnabled
      )}
    </section>

    <section aria-labelledby="usage-settings-heading">
      <h2 id="usage-settings-heading">Usage display</h2>
      <div class="settings-grid">
        <div class="card">
          ${renderNumberSetting(
            "refreshIntervalSeconds",
            "Refresh interval",
            settings.refreshIntervalSeconds,
            5,
            undefined,
            "Seconds between usage updates."
          )}
          ${renderSelectSetting(
            "statusFormat",
            "Status format",
            settings.statusFormat,
            [
              ["compact", "Used percentage"],
              ["remaining", "Remaining percentage"]
            ],
            "Controls the numbers shown in the status bar."
          )}
          ${renderCheckboxSetting(
            "showExtraBuckets",
            "Show model buckets",
            settings.showExtraBuckets,
            "Include model-specific buckets in usage details."
          )}
        </div>
        <div class="card">
          ${renderNumberSetting(
            "warnAtPercent",
            "Warning threshold",
            settings.warnAtPercent,
            1,
            100,
            "Highlight and notify at this usage percentage."
          )}
          ${renderNumberSetting(
            "requestTimeoutMs",
            "Request timeout",
            settings.requestTimeoutMs,
            1000,
            undefined,
            "Milliseconds before an app-server request times out."
          )}
          ${renderTextSetting(
            "codexExecutable",
            "Codex executable",
            settings.codexExecutable,
            "Command name or full path used to start Codex."
          )}
        </div>
      </div>
    </section>

    <section aria-labelledby="notification-settings-heading">
      <h2 id="notification-settings-heading">Notifications</h2>
      <div class="settings-grid">
        <div class="card">
          ${renderSelectSetting(
            "notificationMode",
            "Delivery",
            settings.notificationMode,
            [
              ["vscode", "VS Code"],
              ["native", "Native Linux"],
              ["both", "Both"]
            ],
            "Choose where notifications appear."
          )}
          ${renderSelectSetting(
            "completionChatAction",
            "Completion action",
            settings.completionChatAction,
            [
              ["exact", "Exact chat (experimental)"],
              ["sidebar", "Codex sidebar"],
              ["none", "No action"]
            ],
            "Controls what notification clicks open. Exact chat uses the OpenAI extension's current thread resource, which is not yet a documented public API."
          )}
        </div>
        <div class="card">
          ${renderCheckboxSetting(
            "notifyUsageWarnings",
            "Usage warnings",
            settings.notifyUsageWarnings,
            "Notify when usage reaches the warning threshold."
          )}
          ${renderCheckboxSetting(
            "notifyTurnComplete",
            "Completed turns",
            settings.notifyTurnComplete,
            "Notify when a visible Codex turn completes."
          )}
          ${renderCheckboxSetting(
            "notifyNeedsInput",
            "Input requests",
            settings.notifyNeedsInput,
            "Notify when Codex asks for input or approval."
          )}
        </div>
      </div>
      <div id="save-status" role="status" aria-live="polite"></div>
    </section>
  </main>

  <script nonce="${escapeAttribute(nonce)}">
    const vscode = acquireVsCodeApi();
    const saveStatus = document.getElementById("save-status");
    const previousViewState = vscode.getState();
    const focusSection = (sectionId) => {
      const section = document.getElementById(sectionId);
      if (!section) {
        return;
      }
      section.scrollIntoView({ behavior: "smooth", block: "start" });
      section.focus({ preventScroll: true });
      requestAnimationFrame(() => vscode.setState({ scrollY: window.scrollY }));
    };

    if (${focusRemoteControl ? "true" : "false"}) {
      requestAnimationFrame(() => focusSection("remote-control"));
    } else if (typeof previousViewState?.scrollY === "number") {
      requestAnimationFrame(() => window.scrollTo({ top: previousViewState.scrollY }));
    }

    window.addEventListener("scroll", () => {
      vscode.setState({ scrollY: window.scrollY });
    }, { passive: true });

    for (const button of document.querySelectorAll("[data-command]")) {
      button.addEventListener("click", () => {
        vscode.postMessage({
          type: "command",
          command: button.dataset.command,
          clientId: button.dataset.clientId
        });
      });
    }

    for (const input of document.querySelectorAll("[data-setting]")) {
      input.addEventListener("change", () => {
        let value;
        if (input instanceof HTMLInputElement && input.type === "checkbox") {
          value = input.checked;
        } else if (input instanceof HTMLInputElement && input.type === "number") {
          value = Number(input.value);
        } else {
          value = input.value;
        }

        saveStatus.textContent = "Saving…";
        vscode.postMessage({
          type: "updateSetting",
          key: input.dataset.setting,
          value
        });
      });
    }

    window.addEventListener("message", (event) => {
      if (event.data?.type === "settingSaved") {
        saveStatus.textContent = "Saved.";
      } else if (event.data?.type === "settingError") {
        saveStatus.textContent = event.data.message || "Setting could not be saved.";
      } else if (event.data?.type === "focusSection" && event.data.section === "remote-control") {
        focusSection("remote-control");
      }
    });
  </script>
</body>
</html>`;
}

function renderUsage(
  snapshot: NormalizedUsageSnapshot | null,
  errorMessage: string | null,
  showExtraBuckets: boolean
): string {
  if (!snapshot) {
    const message = errorMessage
      ? `<div class="notice"><strong>Usage unavailable.</strong> ${escapeHtml(errorMessage)}</div>`
      : "";
    return `${message}<p class="muted">Loading account usage…</p>`;
  }

  const buckets = showExtraBuckets ? snapshot.buckets : [snapshot.codex];
  const cards = buckets.map((bucket) => renderBucket(bucket)).join("");
  const notice = errorMessage
    ? `<div class="notice"><strong>Refresh failed.</strong> Showing the last successful result. ${escapeHtml(errorMessage)}</div>`
    : "";

  return `${notice}<div class="bucket-grid">${cards}</div>
    <p class="description">Last refreshed ${escapeHtml(snapshot.fetchedAt.toLocaleString())}</p>`;
}

function renderBucket(bucket: NormalizedUsageBucket): string {
  return `<article class="card">
    <h3>${escapeHtml(bucket.isPrimaryCodex ? "Codex" : bucket.name)}</h3>
    <dl>
      <dt>5-hour</dt>
      <dd>${escapeHtml(formatWindowPercent(bucket.fiveHour))} · resets ${escapeHtml(formatWindowReset(bucket.fiveHour))}</dd>
      <dt>7-day</dt>
      <dd>${escapeHtml(formatWindowPercent(bucket.sevenDay))} · resets ${escapeHtml(formatWindowReset(bucket.sevenDay))}</dd>
      ${bucket.planType ? `<dt>Plan</dt><dd>${escapeHtml(bucket.planType)}</dd>` : ""}
      ${bucket.credits ? `<dt>Credits</dt><dd>${escapeHtml(bucket.credits.unlimited ? "Unlimited" : bucket.credits.balance ?? "Unknown")}</dd>` : ""}
      ${bucket.individualLimit ? `<dt>Spend control</dt><dd>${escapeHtml(`${bucket.individualLimit.remainingPercent}% remaining`)}</dd>` : ""}
    </dl>
  </article>`;
}

function renderResetCredits(summary: RateLimitResetCreditsSummary | null): string {
  const availableCount = summary?.availableCount ?? 0;
  const buttonDisabled = availableCount <= 0 ? " disabled" : "";
  const details = renderResetCreditDetails(summary);

  return `<div class="reset-heading">
      <div>
        <h2 id="reset-heading">Reset credits</h2>
        <p class="muted">${escapeHtml(summary ? `${availableCount} available` : "Availability unknown")}</p>
      </div>
      <button type="button" data-command="reset"${buttonDisabled}>Use reset credit</button>
    </div>
    <p class="description">Uses the available credit that expires first. Confirmation required.</p>
    ${details}`;
}

function renderResetCreditDetails(summary: RateLimitResetCreditsSummary | null): string {
  if (!summary) {
    return `<p class="muted">Reset-credit details are unavailable.</p>`;
  }

  if (!summary.credits) {
    return summary.availableCount > 0
      ? `<p class="muted">Per-credit details are unavailable from this Codex version.</p>`
      : `<p class="muted">No reset credits are available.</p>`;
  }

  if (summary.credits.length === 0) {
    return `<p class="muted">No reset-credit details were returned.</p>`;
  }

  return summary.credits.map((credit) => `<article class="card credit">
      <h3>${escapeHtml(credit.title ?? "Reset credit")}</h3>
      <dl>
        <dt>Status</dt><dd>${escapeHtml(credit.status)}</dd>
        <dt>Applies to</dt><dd>${escapeHtml(formatResetCreditType(credit.resetType))}</dd>
        <dt>Granted</dt><dd>${escapeHtml(formatResetTime(credit.grantedAt))}</dd>
        <dt>Expires</dt><dd>${escapeHtml(formatResetCreditExpiry(credit))}</dd>
        ${credit.description ? `<dt>Details</dt><dd>${escapeHtml(credit.description.replace(/\s+/g, " ").trim())}</dd>` : ""}
      </dl>
    </article>`).join("");
}

function renderAccount(snapshot: NormalizedUsageSnapshot | null): string {
  if (!snapshot) {
    return `<p class="muted">Account details will appear after usage loads.</p>`;
  }

  const summary = snapshot.tokenUsage?.summary;
  const recentDaily = snapshot.tokenUsage?.dailyUsageBuckets;

  return `<div class="summary-grid">
      <div class="card">
        <h3>Account summary</h3>
        <dl>
          ${snapshot.codex.planType ? `<dt>Plan</dt><dd>${escapeHtml(snapshot.codex.planType)}</dd>` : ""}
          ${snapshot.codex.credits ? `<dt>Credits</dt><dd>${escapeHtml(snapshot.codex.credits.unlimited ? "Unlimited" : snapshot.codex.credits.balance ?? "Unknown")}</dd>` : ""}
          ${summary ? `<dt>Lifetime tokens</dt><dd>${escapeHtml(formatInteger(summary.lifetimeTokens))}</dd>` : ""}
          ${summary ? `<dt>Peak daily</dt><dd>${escapeHtml(formatInteger(summary.peakDailyTokens))}</dd>` : ""}
          ${summary ? `<dt>Current streak</dt><dd>${escapeHtml(`${formatInteger(summary.currentStreakDays)} days`)}</dd>` : ""}
          ${recentDaily ? `<dt>Last 7 days</dt><dd>${escapeHtml(formatRecentTokenTotal(recentDaily))}</dd>` : ""}
        </dl>
      </div>
      <div class="card">
        <h3>Recent daily tokens</h3>
        ${recentDaily
          ? `<pre>${escapeHtml(formatRecentDailyUsage(recentDaily))}</pre>`
          : `<p class="muted">Daily token data is unavailable.</p>`}
      </div>
    </div>`;
}

function renderRemoteControl(
  state: RemoteControlViewState,
  configuredEnabled: boolean,
  sharedHostEnabled: boolean
): string {
  const disabled = state.busy ? " disabled" : "";
  const status = state.status?.status ?? (state.supported ? "disabled" : "unavailable");
  const statusLabel = status === "connected"
    ? "Connected to OpenAI relay"
    : status === "connecting"
      ? "Connecting to OpenAI relay"
      : status === "errored"
        ? "Connection error"
        : status === "disabled"
          ? "Disabled"
          : "Unavailable";
  const pairDisabled = state.busy || !state.supported;
  const pairLabel = configuredEnabled ? "Create pairing code" : "Enable and create pairing code";
  const error = state.errorMessage
    ? `<div class="notice"><strong>Remote control needs attention.</strong> ${escapeHtml(state.errorMessage)}</div>`
    : "";
  const pairing = state.pairing
    ? `<article class="card">
        <h3>Manual pairing code</h3>
        <p class="pair-code">${escapeHtml(state.pairing.manualPairingCode)}</p>
        <p class="description">Open <strong>Remote</strong> in the ChatGPT mobile app, add this computer, and enter the code. It expires ${escapeHtml(new Date(state.pairing.expiresAt * 1000).toLocaleString())}.</p>
        <div class="actions">
          <button type="button" data-command="remoteCopyPairingCode">Copy pairing code</button>
        </div>
      </article>`
    : "";
  const devices = state.clients.length > 0
    ? `<div class="card">${state.clients.map(renderRemoteControlDevice).join("")}</div>`
    : `<p class="muted">No paired controller devices were returned.</p>`;
  const removeDisabled = state.busy || (
    !configuredEnabled &&
    state.status?.status === "disabled" &&
    state.clients.length === 0
  );

  return `${error}
    <div class="summary-grid">
      <div class="card">
        <h3>Connection</h3>
        <dl>
          <dt>Status</dt><dd>${escapeHtml(statusLabel)}</dd>
          ${state.status?.serverName ? `<dt>Computer</dt><dd>${escapeHtml(state.status.serverName)}</dd>` : ""}
        </dl>
        ${renderCheckboxSetting(
          "remoteControlEnabled",
          "Enable remote access",
          configuredEnabled,
          "Reconnect through OpenAI's secure internet relay whenever this extension starts. One Companion window owns the relay at a time."
        )}
        <div class="actions">
          <button type="button" data-command="remotePair"${pairDisabled ? " disabled" : ""}>${pairLabel}</button>
          <button type="button" class="secondary" data-command="remoteRefresh"${disabled}>Refresh</button>
          <button type="button" class="secondary" data-command="remoteDisable"${configuredEnabled && !state.busy ? "" : " disabled"}>Disable</button>
        </div>
      </div>
      <div class="card">
        <h3>How it works</h3>
        <p>Pair once, then use the ChatGPT mobile app from any internet connection to start or continue chats, send instructions, review outputs, and approve or reject actions.</p>
        <p class="description">The computer must remain awake, online, and running VS Code. Pairing is opt-in. No public TCP listener is opened; optional shared-host mode uses only a temporary owner-readable local Unix socket. Codex Companion owns only the local relay lifecycle and paired-device grants; OpenAI's Remote service and ChatGPT app own the phone interface and its synchronized chat list.</p>
      </div>
    </div>
    <article class="card credit">
      <h3>Shared live stream (experimental)</h3>
      ${renderCheckboxSetting(
        "sharedRemoteHostEnabled",
        "Use one app-server for Remote and a Codex terminal",
        sharedHostEnabled,
        "Starts Companion on a private local Unix socket. Chats opened in the Shared Codex Terminal and on the paired phone then use the same live app-server stream."
      )}
      <p class="description">This does not connect the official VS Code Codex panel, which still owns a separate app-server process. After enabling this option, start or continue the chats you want to follow remotely in the Shared Codex Terminal. Changing the option restarts Companion's app-server and closes any existing shared terminal session.</p>
      ${state.sharedHostSupported
        ? `<div class="actions">
            <button type="button" data-command="remoteOpenSharedTerminal"${sharedHostEnabled && !state.busy ? "" : " disabled"}>Open Shared Codex Terminal</button>
          </div>`
        : `<p class="description">The shared host currently requires Linux or macOS.</p>`}
    </article>
    ${pairing}
    <h3>Paired devices</h3>
    ${devices}
    <article class="card credit">
      <h3>Phone chat list or activity looks stale?</h3>
      <p>Chats started or continued through this Remote host can stream live activity. In shared-host mode, use the Shared Codex Terminal so the computer and phone consume the same app-server stream. A chat running in the separate official VS Code Codex panel is visible here only through saved history, so its phone output and Thinking or Working indicator can lag until you close and reopen the chat.</p>
      <p class="description">Codex reports live thread status only inside the app-server process running that turn. Its supported API cannot subscribe to another process's turn events, force-refresh ChatGPT's list, or list and delete saved Remote environments. If the open chat streams correctly while its list row has no activity icon, that list rendering is controlled by the ChatGPT mobile app.</p>
      <div class="actions">
        <button type="button" class="secondary" data-command="restart"${disabled}>Restart App Server</button>
      </div>
    </article>
    <article class="card credit">
      <h3>Remove remote connection</h3>
      <p>Turn off this window's relay and revoke every paired device returned by Codex. This does not delete OpenAI's saved Remote environment or clear the phone app's chat list.</p>
      <div class="actions">
        <button type="button" class="secondary" data-command="remoteRemove"${removeDisabled ? " disabled" : ""}>Remove Remote Connection</button>
      </div>
    </article>`;
}

function renderRemoteControlDevice(device: RemoteControlClientDevice): string {
  const name = device.displayName ?? device.deviceModel ?? device.deviceType ?? "ChatGPT device";
  const details = [device.platform, device.osVersion, device.appVersion ? `ChatGPT ${device.appVersion}` : null]
    .filter((value): value is string => Boolean(value))
    .join(" · ");
  const lastSeen = device.lastSeenAt
    ? `Last seen ${new Date(device.lastSeenAt * 1000).toLocaleString()}`
    : "Last-seen time unavailable";

  return `<div class="device-row">
      <div>
        <strong>${escapeHtml(name)}</strong>
        ${details ? `<p class="description">${escapeHtml(details)}</p>` : ""}
        <p class="description">${escapeHtml(lastSeen)}</p>
      </div>
      <button type="button" class="secondary" data-command="remoteRevoke" data-client-id="${escapeAttribute(device.clientId)}">Revoke</button>
    </div>`;
}

function renderNumberSetting(
  key: string,
  label: string,
  value: number,
  minimum: number,
  maximum: number | undefined,
  description: string
): string {
  const maximumAttribute = maximum === undefined ? "" : ` max="${maximum}"`;
  return `<div class="setting">
    <label for="${key}">${escapeHtml(label)}</label>
    <input id="${key}" type="number" min="${minimum}"${maximumAttribute} value="${value}" data-setting="${key}">
    <p class="description">${escapeHtml(description)}</p>
  </div>`;
}

function renderTextSetting(
  key: string,
  label: string,
  value: string,
  description: string
): string {
  return `<div class="setting">
    <label for="${key}">${escapeHtml(label)}</label>
    <input id="${key}" type="text" value="${escapeAttribute(value)}" data-setting="${key}">
    <p class="description">${escapeHtml(description)}</p>
  </div>`;
}

function renderCheckboxSetting(
  key: string,
  label: string,
  checked: boolean,
  description: string
): string {
  return `<div class="setting checkbox">
    <label for="${key}">
      <input id="${key}" type="checkbox"${checked ? " checked" : ""} data-setting="${key}">
      ${escapeHtml(label)}
    </label>
    <p class="description">${escapeHtml(description)}</p>
  </div>`;
}

function renderSelectSetting(
  key: string,
  label: string,
  selectedValue: string,
  options: Array<[string, string]>,
  description: string
): string {
  const optionHtml = options.map(([value, text]) =>
    `<option value="${escapeAttribute(value)}"${value === selectedValue ? " selected" : ""}>${escapeHtml(text)}</option>`
  ).join("");

  return `<div class="setting">
    <label for="${key}">${escapeHtml(label)}</label>
    <select id="${key}" data-setting="${key}">${optionHtml}</select>
    <p class="description">${escapeHtml(description)}</p>
  </div>`;
}

function formatWindowReset(window: RateLimitWindow | null): string {
  if (!window) {
    return "N/A";
  }

  return window.resetsAt ? formatResetShort(window.resetsAt) : "unknown";
}

function normalizeNumberSetting(
  key: string,
  value: unknown,
  minimum: number,
  maximum = Number.POSITIVE_INFINITY
): NormalizedSettingUpdate | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  const normalized = Math.round(value);
  if (normalized < minimum || normalized > maximum) {
    return null;
  }

  return { key, value: normalized };
}

function escapeHtml(value: string | number): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}
