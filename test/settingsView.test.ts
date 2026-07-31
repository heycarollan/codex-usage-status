import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSettingUpdate, renderSettingsView } from "../src/settingsView";
import type { ExtensionSettings, NormalizedUsageSnapshot } from "../src/types";

const settings: ExtensionSettings = {
  codexExecutableSource: "path",
  refreshIntervalSeconds: 10,
  codexExecutable: "codex",
  showExtraBuckets: true,
  statusFormat: "compact",
  warnAtPercent: 90,
  requestTimeoutMs: 12000,
  notifyUsageWarnings: true,
  notifyTurnComplete: true,
  notifyNeedsInput: true,
  notificationMode: "vscode",
  completionChatAction: "exact",
  remoteControlEnabled: false
};

const remoteControl = {
  supported: true,
  busy: false,
  status: {
    status: "disabled" as const,
    serverName: "workstation",
    installationId: "installation-1",
    environmentId: null
  },
  pairing: null,
  clients: [],
  errorMessage: null
};

const snapshot: NormalizedUsageSnapshot = {
  codex: {
    id: "codex",
    name: "Codex",
    isPrimaryCodex: true,
    fiveHour: { usedPercent: 12, windowDurationMins: 300, resetsAt: 2000 },
    sevenDay: { usedPercent: 34, windowDurationMins: 10080, resetsAt: 3000 },
    planType: "plus",
    credits: { hasCredits: true, unlimited: false, balance: "5" },
    individualLimit: null,
    rateLimitReachedType: null
  },
  buckets: [
    {
      id: "codex",
      name: "Codex",
      isPrimaryCodex: true,
      fiveHour: { usedPercent: 12, windowDurationMins: 300, resetsAt: 2000 },
      sevenDay: { usedPercent: 34, windowDurationMins: 10080, resetsAt: 3000 },
      planType: "plus",
      credits: { hasCredits: true, unlimited: false, balance: "5" },
      individualLimit: null,
      rateLimitReachedType: null
    },
    {
      id: "codex_spark",
      name: "Codex Spark",
      isPrimaryCodex: false,
      fiveHour: { usedPercent: 2, windowDurationMins: 300, resetsAt: null },
      sevenDay: { usedPercent: 4, windowDurationMins: 10080, resetsAt: null },
      planType: "plus",
      credits: null,
      individualLimit: null,
      rateLimitReachedType: null
    }
  ],
  resetCredits: {
    availableCount: 1,
    credits: [
      {
        id: "credit-1",
        resetType: "codexRateLimits",
        status: "available",
        grantedAt: 1000,
        expiresAt: 4000,
        title: "Full reset",
        description: "Resets the current Codex rate limits."
      }
    ]
  },
  tokenUsage: {
    summary: {
      lifetimeTokens: 123456,
      peakDailyTokens: 7890,
      longestRunningTurnSec: null,
      currentStreakDays: 4,
      longestStreakDays: null
    },
    dailyUsageBuckets: [
      { startDate: "2026-07-29", tokens: 1000 },
      { startDate: "2026-07-30", tokens: 2000 }
    ]
  },
  fetchedAt: new Date(0)
};

test("renders usage, reset details, actions, and every configurable setting", () => {
  const html = renderSettingsView({
    cspSource: "vscode-webview://test",
    nonce: "nonce-value",
    settings,
    snapshot,
    errorMessage: null,
    remoteControl
  });

  assert.match(html, /Codex Companion/);
  assert.match(html, /Codex Spark/);
  assert.match(html, /12%/);
  assert.match(html, /Lifetime tokens/);
  assert.match(html, new RegExp((123456).toLocaleString()));
  assert.match(html, /Recent daily tokens/);
  assert.match(html, /Full reset/);
  assert.match(html, /Resets the current Codex rate limits\./);
  assert.match(html, /data-command="reset"/);
  assert.doesNotMatch(html, /data-command="reset" disabled/);
  assert.match(html, /data-command="remoteRemove" disabled/);

  for (const key of [
    "refreshIntervalSeconds",
    "codexExecutable",
    "showExtraBuckets",
    "statusFormat",
    "warnAtPercent",
    "requestTimeoutMs",
    "notifyUsageWarnings",
    "notifyTurnComplete",
    "notifyNeedsInput",
    "notificationMode",
    "completionChatAction",
    "remoteControlEnabled"
  ]) {
    assert.match(html, new RegExp(`data-setting="${key}"`));
  }
});

test("renders an unavailable state safely and disables reset", () => {
  const html = renderSettingsView({
    cspSource: "vscode-webview://test",
    nonce: "nonce-value",
    settings: {
      ...settings,
      codexExecutable: `codex"><script>bad()</script>`
    },
    snapshot: null,
    errorMessage: `<script>alert("bad")</script>`,
    remoteControl
  });

  assert.match(html, /Usage unavailable/);
  assert.match(html, /&lt;script&gt;alert\(&quot;bad&quot;\)&lt;\/script&gt;/);
  assert.match(html, /value="codex&quot;&gt;&lt;script&gt;bad\(\)&lt;\/script&gt;"/);
  assert.match(html, /data-command="reset" disabled/);
  assert.doesNotMatch(html, /<script>alert\("bad"\)<\/script>/);
});

test("hides model-specific buckets when disabled", () => {
  const html = renderSettingsView({
    cspSource: "vscode-webview://test",
    nonce: "nonce-value",
    settings: { ...settings, showExtraBuckets: false },
    snapshot,
    errorMessage: null,
    remoteControl
  });

  assert.doesNotMatch(html, /Codex Spark/);
  assert.match(html, /Include model-specific buckets in usage details/);
});

test("validates settings messages before updating VS Code configuration", () => {
  assert.deepEqual(
    normalizeSettingUpdate("refreshIntervalSeconds", 15.4),
    { key: "refreshIntervalSeconds", value: 15 }
  );
  assert.deepEqual(
    normalizeSettingUpdate("notificationMode", "both"),
    { key: "notificationMode", value: "both" }
  );
  assert.deepEqual(
    normalizeSettingUpdate("notifyTurnComplete", false),
    { key: "notifyTurnComplete", value: false }
  );
  assert.deepEqual(
    normalizeSettingUpdate("completionChatAction", "sidebar"),
    { key: "completionChatAction", value: "sidebar" }
  );
  assert.deepEqual(
    normalizeSettingUpdate("remoteControlEnabled", true),
    { key: "remoteControlEnabled", value: true }
  );
  assert.deepEqual(
    normalizeSettingUpdate("codexExecutable", "  /usr/bin/codex  "),
    { key: "codexExecutable", value: "/usr/bin/codex" }
  );

  assert.equal(normalizeSettingUpdate("warnAtPercent", 101), null);
  assert.equal(normalizeSettingUpdate("refreshIntervalSeconds", 4), null);
  assert.equal(normalizeSettingUpdate("notificationMode", "desktop"), null);
  assert.equal(normalizeSettingUpdate("completionChatAction", "private"), null);
  assert.equal(normalizeSettingUpdate("unknownSetting", true), null);
});

test("renders remote pairing and revocable devices without exposing raw markup", () => {
  const html = renderSettingsView({
    cspSource: "vscode-webview://test",
    nonce: "nonce-value",
    settings: { ...settings, remoteControlEnabled: true },
    snapshot,
    errorMessage: null,
    focusRemoteControl: true,
    remoteControl: {
      supported: true,
      busy: false,
      status: {
        status: "connected",
        serverName: `workstation<script>bad()</script>`,
        installationId: "installation-1",
        environmentId: "environment-1"
      },
      pairing: {
        pairingCode: "private-pairing-artifact",
        manualPairingCode: `ABCD-1234<script>bad()</script>`,
        environmentId: "environment-1",
        expiresAt: 2000000000
      },
      clients: [
        {
          clientId: `client\"><script>bad()</script>`,
          displayName: "Carol's phone",
          deviceType: "phone",
          platform: "Android",
          osVersion: "16",
          deviceModel: null,
          appVersion: "1.2.3",
          lastSeenAt: 1900000000
        }
      ],
      errorMessage: null
    }
  });

  assert.match(html, /Connected to OpenAI relay/);
  assert.match(html, /id="remote-control" tabindex="-1"/);
  assert.match(html, /requestAnimationFrame\(\(\) => focusSection\("remote-control"\)\)/);
  assert.match(html, /event\.data\.section === "remote-control"/);
  assert.match(html, /const previousViewState = vscode\.getState\(\)/);
  assert.match(html, /vscode\.setState\(\{ scrollY: window\.scrollY \}\)/);
  assert.match(html, /ABCD-1234&lt;script&gt;bad\(\)&lt;\/script&gt;/);
  assert.match(html, /Carol&#39;s phone/);
  assert.match(html, /data-command="remoteRevoke"/);
  assert.match(html, /data-command="remoteRemove">/);
  assert.match(html, /Remove Remote Connection/);
  assert.match(html, /Phone chat list or activity looks stale\?/);
  assert.match(html, /data-command="restart"/);
  assert.match(html, /live thread status only inside the app-server process/);
  assert.match(html, /cannot subscribe to another process's turn events/);
  assert.match(html, /list row has no activity icon/);
  assert.match(html, /does not delete OpenAI's saved Remote environment/);
  assert.doesNotMatch(html, /private-pairing-artifact/);
  assert.doesNotMatch(html, /<script>bad\(\)<\/script>/);
});
