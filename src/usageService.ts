import { CodexAppServerClient } from "./codexAppServerClient";
import { randomUUID } from "node:crypto";
import type {
  ConsumeAccountRateLimitResetCreditOutcome,
  GetAccountRateLimitsResponse,
  NormalizedUsageBucket,
  NormalizedUsageSnapshot,
  RateLimitSnapshot
} from "./types";

const FIVE_HOURS_MINS = 300;
const SEVEN_DAYS_MINS = 10080;

export class UsageService {
  constructor(private readonly client: CodexAppServerClient) {}

  async readUsage(): Promise<NormalizedUsageSnapshot> {
    const [limits, tokenUsage] = await Promise.all([
      this.client.getRateLimits(),
      this.client.getTokenUsage().catch(() => null)
    ]);

    return normalizeRateLimits(limits, tokenUsage, new Date());
  }

  async consumeResetCredit(): Promise<ConsumeAccountRateLimitResetCreditOutcome> {
    const response = await this.client.consumeRateLimitResetCredit(randomUUID());
    return response.outcome;
  }
}

export function normalizeRateLimits(
  limits: GetAccountRateLimitsResponse,
  tokenUsage: NormalizedUsageSnapshot["tokenUsage"],
  fetchedAt: Date
): NormalizedUsageSnapshot {
  const entries = limits.rateLimitsByLimitId
    ? Object.entries(limits.rateLimitsByLimitId).filter(
        (entry): entry is [string, RateLimitSnapshot] => Boolean(entry[1])
      )
    : [];

  const snapshots = entries.length > 0 ? entries : [["codex", limits.rateLimits] as const];
  const buckets = snapshots.map(([id, snapshot]) => normalizeBucket(id, snapshot));
  const codex = buckets.find((bucket) => bucket.id === "codex") ?? normalizeBucket("codex", limits.rateLimits);
  const orderedBuckets = [codex, ...buckets.filter((bucket) => bucket.id !== codex.id)];

  return {
    codex,
    buckets: orderedBuckets,
    resetCredits: limits.rateLimitResetCredits,
    tokenUsage,
    fetchedAt
  };
}

function normalizeBucket(id: string, snapshot: RateLimitSnapshot): NormalizedUsageBucket {
  const windows = [snapshot.primary, snapshot.secondary].filter((window) => window !== null);
  const fiveHour =
    windows.find((window) => window.windowDurationMins === FIVE_HOURS_MINS) ?? snapshot.primary ?? null;
  const sevenDay =
    windows.find((window) => window.windowDurationMins === SEVEN_DAYS_MINS) ?? snapshot.secondary ?? null;

  return {
    id,
    name: snapshot.limitName || humanizeBucketName(id),
    isPrimaryCodex: id === "codex",
    fiveHour,
    sevenDay,
    planType: snapshot.planType,
    credits: snapshot.credits,
    individualLimit: snapshot.individualLimit,
    rateLimitReachedType: snapshot.rateLimitReachedType
  };
}

function humanizeBucketName(id: string): string {
  if (id === "codex") {
    return "Codex";
  }

  return id
    .replace(/^codex_/, "")
    .split(/[_-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
