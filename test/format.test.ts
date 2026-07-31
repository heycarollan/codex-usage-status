import assert from "node:assert/strict";
import test from "node:test";
import { formatDetails, formatResetCreditsDetails, formatWindowLine } from "../src/formatCore";
import type { ExtensionSettings, NormalizedUsageSnapshot } from "../src/types";

const settings: ExtensionSettings = {
  codexExecutableSource: "path",
  refreshIntervalSeconds: 90,
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

test("formats missing windows as N/A", () => {
  assert.equal(formatWindowLine(null), "N/A");
});

test("formats details with primary and extra bucket names", () => {
  const snapshot: NormalizedUsageSnapshot = {
    codex: {
      id: "codex",
      name: "Codex",
      isPrimaryCodex: true,
      fiveHour: { usedPercent: 1, windowDurationMins: 300, resetsAt: null },
      sevenDay: { usedPercent: 8, windowDurationMins: 10080, resetsAt: null },
      planType: "prolite",
      credits: { hasCredits: false, unlimited: false, balance: "0" },
      individualLimit: null,
      rateLimitReachedType: null
    },
    buckets: [
      {
        id: "codex",
        name: "Codex",
        isPrimaryCodex: true,
        fiveHour: { usedPercent: 1, windowDurationMins: 300, resetsAt: null },
        sevenDay: { usedPercent: 8, windowDurationMins: 10080, resetsAt: null },
        planType: "prolite",
        credits: { hasCredits: false, unlimited: false, balance: "0" },
        individualLimit: null,
        rateLimitReachedType: null
      },
      {
        id: "codex_bengalfox",
        name: "GPT-5.3-Codex-Spark",
        isPrimaryCodex: false,
        fiveHour: { usedPercent: 0, windowDurationMins: 300, resetsAt: null },
        sevenDay: { usedPercent: 0, windowDurationMins: 10080, resetsAt: null },
        planType: "prolite",
        credits: null,
        individualLimit: null,
        rateLimitReachedType: null
      }
    ],
    resetCredits: { availableCount: 3 },
    tokenUsage: {
      summary: {
        lifetimeTokens: 123456,
        peakDailyTokens: 7890,
        longestRunningTurnSec: null,
        currentStreakDays: 4,
        longestStreakDays: null
      },
      dailyUsageBuckets: null
    },
    fetchedAt: new Date(0)
  };

  const details = formatDetails(snapshot, settings);

  assert.match(details, /Codex/);
  assert.match(details, /GPT-5\.3-Codex-Spark/);
  assert.match(details, /Reset credits: 3/);
  assert.equal(
    details.match(/^Lifetime tokens: (.*)$/m)?.[1],
    (123456).toLocaleString(),
  );
});

test("formats reset-credit grant and expiration details", () => {
  const details = formatResetCreditsDetails({
    availableCount: 2,
    credits: [
      {
        id: "credit-1",
        resetType: "codexRateLimits",
        status: "available",
        grantedAt: 1000,
        expiresAt: 2000,
        title: "Full reset",
        description: "One free rate limit reset."
      },
      {
        id: "credit-2",
        resetType: "codexRateLimits",
        status: "available",
        grantedAt: 3000,
        expiresAt: null,
        title: null,
        description: null
      }
    ]
  });

  assert.match(details, /Reset credits: 2/);
  assert.match(details, /Full reset/);
  assert.match(details, /Status: available/);
  assert.match(details, /Applies to: Codex rate limits/);
  assert.match(details, /Granted:/);
  assert.match(details, /Expires:/);
  assert.match(details, /One free rate limit reset\./);
  assert.match(details, /Does not expire/);
});

test("reports when an older Codex version omits reset-credit details", () => {
  assert.equal(
    formatResetCreditsDetails({ availableCount: 1 }),
    "Reset credits: 1\n  Details: unavailable from this Codex version"
  );
});
