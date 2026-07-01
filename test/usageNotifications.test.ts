import assert from "node:assert/strict";
import test from "node:test";
import { evaluateUsageAlerts, formatUsageAlertMessage } from "../src/usageNotifications";
import type { NormalizedUsageSnapshot, RateLimitWindow } from "../src/types";

test("usage warning alerts once while over threshold", () => {
  const first = evaluateUsageAlerts(snapshot(window(91)), 90, new Set());

  assert.equal(first.alerts.length, 1);
  assert.equal(first.alerts[0].kind, "warning");
  assert.equal(first.alerts[0].label, "5-hour");
  assert.equal(first.alerts[0].usedPercent, 91);

  const second = evaluateUsageAlerts(snapshot(window(92)), 90, first.activeKeys);
  assert.equal(second.alerts.length, 0);
});

test("usage warning re-arms after dropping below threshold", () => {
  const first = evaluateUsageAlerts(snapshot(window(95)), 90, new Set());
  const reset = evaluateUsageAlerts(snapshot(window(60)), 90, first.activeKeys);
  const second = evaluateUsageAlerts(snapshot(window(90)), 90, reset.activeKeys);

  assert.equal(reset.activeKeys.size, 0);
  assert.equal(second.alerts.length, 1);
  assert.equal(second.alerts[0].kind, "warning");
});

test("limit alert fires separately from warning", () => {
  const warning = evaluateUsageAlerts(snapshot(window(95)), 90, new Set());
  const limit = evaluateUsageAlerts(snapshot(window(100)), 90, warning.activeKeys);

  assert.equal(limit.alerts.length, 1);
  assert.equal(limit.alerts[0].kind, "limit");
  assert.equal(limit.activeKeys.has("fiveHour:warning:90"), true);
  assert.equal(limit.activeKeys.has("fiveHour:limit"), true);
});

test("formats usage alert messages", () => {
  const evaluation = evaluateUsageAlerts(
    snapshot(window(100, 1), window(93)),
    90,
    new Set()
  );
  const message = formatUsageAlertMessage(evaluation.alerts);

  assert.match(message, /^Codex usage limit reached:/);
  assert.match(message, /5-hour 100%/);
  assert.match(message, /7-day 93%/);
});

function snapshot(fiveHour: RateLimitWindow, sevenDay: RateLimitWindow | null = null): NormalizedUsageSnapshot {
  const codex = {
    id: "codex",
    name: "Codex",
    isPrimaryCodex: true,
    fiveHour,
    sevenDay,
    planType: "prolite" as const,
    credits: null,
    individualLimit: null,
    rateLimitReachedType: null
  };

  return {
    codex,
    buckets: [codex],
    resetCredits: null,
    tokenUsage: null,
    fetchedAt: new Date(0)
  };
}

function window(usedPercent: number, resetsAt: number | null = null): RateLimitWindow {
  return {
    usedPercent,
    windowDurationMins: 300,
    resetsAt
  };
}
