import assert from "node:assert/strict";
import test from "node:test";
import type { GetAccountRateLimitsResponse } from "../src/types";
import { normalizeRateLimits } from "../src/usageService";

test("normalizes primary codex and extra buckets", () => {
  const response: GetAccountRateLimitsResponse = {
    rateLimits: {
      limitId: "codex",
      limitName: null,
      primary: { usedPercent: 12, windowDurationMins: 300, resetsAt: 1000 },
      secondary: { usedPercent: 34, windowDurationMins: 10080, resetsAt: 2000 },
      credits: { hasCredits: false, unlimited: false, balance: "0" },
      individualLimit: null,
      planType: "plus",
      rateLimitReachedType: null
    },
    rateLimitsByLimitId: {
      codex: {
        limitId: "codex",
        limitName: null,
        primary: { usedPercent: 12, windowDurationMins: 300, resetsAt: 1000 },
        secondary: { usedPercent: 34, windowDurationMins: 10080, resetsAt: 2000 },
        credits: { hasCredits: false, unlimited: false, balance: "0" },
        individualLimit: null,
        planType: "plus",
        rateLimitReachedType: null
      },
      codex_bengalfox: {
        limitId: "codex_bengalfox",
        limitName: "GPT-5.3-Codex-Spark",
        primary: { usedPercent: 1, windowDurationMins: 300, resetsAt: 3000 },
        secondary: { usedPercent: 2, windowDurationMins: 10080, resetsAt: 4000 },
        credits: null,
        individualLimit: null,
        planType: "plus",
        rateLimitReachedType: null
      }
    },
    rateLimitResetCredits: { availableCount: 3 }
  };

  const snapshot = normalizeRateLimits(response, null, new Date(0));

  assert.equal(snapshot.codex.fiveHour?.usedPercent, 12);
  assert.equal(snapshot.codex.sevenDay?.usedPercent, 34);
  assert.equal(snapshot.buckets.length, 2);
  assert.equal(snapshot.buckets[1].name, "GPT-5.3-Codex-Spark");
  assert.equal(snapshot.resetCredits?.availableCount, 3);
});

test("falls back to historical single-bucket response", () => {
  const response: GetAccountRateLimitsResponse = {
    rateLimits: {
      limitId: "codex",
      limitName: null,
      primary: { usedPercent: 5, windowDurationMins: 300, resetsAt: null },
      secondary: { usedPercent: 9, windowDurationMins: 10080, resetsAt: null },
      credits: null,
      individualLimit: null,
      planType: "unknown",
      rateLimitReachedType: null
    },
    rateLimitsByLimitId: null,
    rateLimitResetCredits: null
  };

  const snapshot = normalizeRateLimits(response, null, new Date(0));

  assert.equal(snapshot.codex.id, "codex");
  assert.equal(snapshot.codex.name, "Codex");
  assert.equal(snapshot.codex.fiveHour?.usedPercent, 5);
  assert.equal(snapshot.codex.sevenDay?.usedPercent, 9);
});
