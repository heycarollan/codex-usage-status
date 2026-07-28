import assert from "node:assert/strict";
import test from "node:test";
import type { CodexAppServerClient } from "../src/codexAppServerClient";
import type { GetAccountRateLimitsResponse } from "../src/types";
import { UsageService, normalizeRateLimits, selectEarliestExpiringResetCredit } from "../src/usageService";

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

test("does not mislabel a lone 7-day primary window as 5-hour usage", () => {
  const sevenDayWindow = { usedPercent: 12, windowDurationMins: 10080, resetsAt: 1785629904 };
  const response: GetAccountRateLimitsResponse = {
    rateLimits: {
      limitId: "codex",
      limitName: null,
      primary: sevenDayWindow,
      secondary: null,
      credits: null,
      individualLimit: null,
      planType: "prolite",
      rateLimitReachedType: null
    },
    rateLimitsByLimitId: {
      codex: {
        limitId: "codex",
        limitName: null,
        primary: sevenDayWindow,
        secondary: null,
        credits: null,
        individualLimit: null,
        planType: "prolite",
        rateLimitReachedType: null
      }
    },
    rateLimitResetCredits: null
  };

  const snapshot = normalizeRateLimits(response, null, new Date(0));

  assert.equal(snapshot.codex.fiveHour, null);
  assert.equal(snapshot.codex.sevenDay, sevenDayWindow);
});

test("selects the available reset credit closest to expiration", () => {
  const selected = selectEarliestExpiringResetCredit({
    availableCount: 3,
    credits: [
      {
        id: "never-expires",
        resetType: "codexRateLimits",
        status: "available",
        grantedAt: 100,
        expiresAt: null,
        title: null,
        description: null
      },
      {
        id: "already-redeemed",
        resetType: "codexRateLimits",
        status: "redeemed",
        grantedAt: 50,
        expiresAt: 500,
        title: null,
        description: null
      },
      {
        id: "expires-later",
        resetType: "codexRateLimits",
        status: "available",
        grantedAt: 200,
        expiresAt: 2000,
        title: null,
        description: null
      },
      {
        id: "expires-first",
        resetType: "codexRateLimits",
        status: "available",
        grantedAt: 300,
        expiresAt: 1000,
        title: null,
        description: null
      }
    ]
  });

  assert.equal(selected?.id, "expires-first");
});

test("falls back to automatic reset-credit selection when details are unavailable", () => {
  assert.equal(selectEarliestExpiringResetCredit({ availableCount: 1 }), null);
});

test("forwards the selected reset credit id to Codex", async () => {
  let receivedIdempotencyKey: string | undefined;
  let receivedCreditId: string | undefined;
  const client = {
    async consumeRateLimitResetCredit(idempotencyKey: string, creditId?: string) {
      receivedIdempotencyKey = idempotencyKey;
      receivedCreditId = creditId;
      return { outcome: "reset" as const };
    }
  } as unknown as CodexAppServerClient;
  const service = new UsageService(client);

  const outcome = await service.consumeResetCredit("expires-first");

  assert.equal(outcome, "reset");
  assert.match(receivedIdempotencyKey ?? "", /^[0-9a-f-]{36}$/);
  assert.equal(receivedCreditId, "expires-first");
});
