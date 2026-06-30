import type {
  AccountTokenUsageDailyBucket,
  ExtensionSettings,
  NormalizedUsageBucket,
  NormalizedUsageSnapshot,
  RateLimitWindow
} from "./types";

export function formatDetails(snapshot: NormalizedUsageSnapshot, settings: ExtensionSettings): string {
  const buckets = settings.showExtraBuckets ? snapshot.buckets : [snapshot.codex];
  const lines: string[] = [];

  for (const bucket of buckets) {
    lines.push(bucket.name);
    lines.push(`  5-hour window: ${formatWindowLine(bucket.fiveHour)}`);
    lines.push(`  7-day window: ${formatWindowLine(bucket.sevenDay)}`);

    if (bucket.planType) {
      lines.push(`  Plan: ${bucket.planType}`);
    }

    if (bucket.credits) {
      const balance = bucket.credits.unlimited ? "unlimited" : bucket.credits.balance ?? "unknown";
      lines.push(`  Credits: ${balance}`);
    }

    if (bucket.individualLimit) {
      lines.push(`  Spend control: ${bucket.individualLimit.remainingPercent}% remaining`);
    }

    lines.push("");
  }

  if (snapshot.resetCredits) {
    lines.push(`Reset credits: ${snapshot.resetCredits.availableCount}`);
  }

  if (snapshot.tokenUsage?.summary) {
    const summary = snapshot.tokenUsage.summary;
    lines.push(`Lifetime tokens: ${formatInteger(summary.lifetimeTokens)}`);
    lines.push(`Peak daily tokens: ${formatInteger(summary.peakDailyTokens)}`);
    lines.push(`Current streak: ${formatInteger(summary.currentStreakDays)} days`);
  }

  lines.push(`Fetched: ${snapshot.fetchedAt.toLocaleString()}`);
  return lines.join("\n").trim();
}

export function formatBucketSummary(bucket: NormalizedUsageBucket): string {
  return `5h ${formatWindowPercent(bucket.fiveHour)} | 7d ${formatWindowPercent(bucket.sevenDay)}`;
}

export function formatRecentDailyUsage(
  buckets: AccountTokenUsageDailyBucket[] | null | undefined,
  days = 7
): string {
  const recent = getRecentDailyUsage(buckets, days);

  if (recent.length === 0) {
    return "unknown";
  }

  return recent.map((bucket) => `${bucket.startDate}: ${formatInteger(bucket.tokens)}`).join("\n");
}

export function formatRecentTokenTotal(
  buckets: AccountTokenUsageDailyBucket[] | null | undefined,
  days = 7
): string {
  const recent = getRecentDailyUsage(buckets, days);

  if (recent.length === 0) {
    return "unknown";
  }

  return formatInteger(recent.reduce((total, bucket) => total + bucket.tokens, 0));
}

export function formatWindowLine(window: RateLimitWindow | null): string {
  if (!window) {
    return "unknown";
  }

  const reset = window.resetsAt ? `, resets ${formatResetTime(window.resetsAt)}` : "";
  return `${window.usedPercent}% used${reset}`;
}

export function formatWindowPercent(window: RateLimitWindow | null): string {
  return window ? `${window.usedPercent}%` : "?";
}

export function formatWindowRemaining(window: RateLimitWindow | null): string {
  return window ? `${Math.max(0, 100 - window.usedPercent)}% left` : "?";
}

export function formatResetTime(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

export function formatResetShort(unixSeconds: number | null | undefined): string {
  if (!unixSeconds) {
    return "unknown";
  }

  return new Date(unixSeconds * 1000).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

export function formatInteger(value: number | null | undefined): string {
  return typeof value === "number" ? value.toLocaleString() : "unknown";
}

function getRecentDailyUsage(
  buckets: AccountTokenUsageDailyBucket[] | null | undefined,
  days: number
): AccountTokenUsageDailyBucket[] {
  if (!buckets || buckets.length === 0) {
    return [];
  }

  return [...buckets]
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .slice(-days);
}
