import assert from "node:assert/strict";
import test from "node:test";
import { formatDetails, formatWindowLine } from "../src/formatCore";
import type { ExtensionSettings, NormalizedUsageSnapshot } from "../src/types";

const settings: ExtensionSettings = {
  refreshIntervalSeconds: 90,
  codexExecutable: "codex",
  showExtraBuckets: true,
  statusFormat: "compact",
  warnAtPercent: 90,
  requestTimeoutMs: 12000,
  notifyUsageWarnings: true,
  notifyTurnComplete: true,
  notifyNeedsInput: true,
  notificationMode: "native"
};

test("formats missing windows as unknown", () => {
  assert.equal(formatWindowLine(null), "unknown");
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
  assert.match(details, /Lifetime tokens: 123,456/);
});
