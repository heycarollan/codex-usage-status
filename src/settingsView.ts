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

export interface SettingsViewState {
  cspSource: string;
  nonce: string;
  settings: ExtensionSettings;
  snapshot: NormalizedUsageSnapshot | null;
  errorMessage: string | null;
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
      return typeof value === "boolean" ? { key, value } : null;
    case "statusFormat":
      return value === "compact" || value === "remaining" ? { key, value } : null;
    case "notificationMode":
      return value === "native" || value === "vscode" || value === "both"
        ? { key, value }
        : null;
    default:
      return null;
  }
}

export function renderSettingsView(state: SettingsViewState): string {
  const { cspSource, nonce, settings, snapshot, errorMessage } = state;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${escapeAttribute(cspSource)} 'nonce-${escapeAttribute(nonce)}'; script-src 'nonce-${escapeAttribute(nonce)}';">
  <title>Codex Usage Settings</title>
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
        <h1>Codex Usage Settings</h1>
        <p class="muted">Live usage, reset credits, and extension preferences in one place.</p>
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

    for (const button of document.querySelectorAll("[data-command]")) {
      button.addEventListener("click", () => {
        vscode.postMessage({ type: "command", command: button.dataset.command });
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
