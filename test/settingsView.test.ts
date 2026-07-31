import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSettingUpdate, renderSettingsView } from "../src/settingsView";
import type { ExtensionSettings, NormalizedUsageSnapshot } from "../src/types";

const settings: ExtensionSettings = {
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
  completionChatAction: "exact"
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
    errorMessage: null
  });

  assert.match(html, /Codex Usage Settings/);
  assert.match(html, /Codex Spark/);
  assert.match(html, /12%/);
  assert.match(html, /Lifetime tokens/);
  assert.match(html, /123,456/);
  assert.match(html, /Recent daily tokens/);
  assert.match(html, /Full reset/);
  assert.match(html, /Resets the current Codex rate limits\./);
  assert.match(html, /data-command="reset"/);
  assert.doesNotMatch(html, /data-command="reset" disabled/);

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
    "completionChatAction"
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
    errorMessage: `<script>alert("bad")</script>`
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
    errorMessage: null
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
    normalizeSettingUpdate("codexExecutable", "  /usr/bin/codex  "),
    { key: "codexExecutable", value: "/usr/bin/codex" }
  );

  assert.equal(normalizeSettingUpdate("warnAtPercent", 101), null);
  assert.equal(normalizeSettingUpdate("refreshIntervalSeconds", 4), null);
  assert.equal(normalizeSettingUpdate("notificationMode", "desktop"), null);
  assert.equal(normalizeSettingUpdate("completionChatAction", "private"), null);
  assert.equal(normalizeSettingUpdate("unknownSetting", true), null);
});
