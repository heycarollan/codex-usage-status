import * as vscode from "vscode";
import {
  formatBucketSummary,
  formatDetails,
  formatInteger,
  formatRecentDailyUsage,
  formatRecentTokenTotal,
  formatResetShort,
  formatResetTime,
  formatWindowLine,
  formatWindowPercent,
  formatWindowRemaining
} from "./formatCore";
import type {
  ExtensionSettings,
  NormalizedUsageBucket,
  NormalizedUsageSnapshot,
  RateLimitWindow
} from "./types";

export { formatDetails, formatResetTime, formatWindowLine } from "./formatCore";

export interface StatusPresentation {
  text: string;
  tooltip: vscode.MarkdownString;
  color?: vscode.ThemeColor;
  backgroundColor?: vscode.ThemeColor;
  accessibilityLabel: string;
}

export interface UsageQuickPickItem extends vscode.QuickPickItem {
  action?: "refresh" | "openLogs" | "resetUsage";
}

export function formatStatus(snapshot: NormalizedUsageSnapshot, settings: ExtensionSettings): StatusPresentation {
  const fiveHour = snapshot.codex.fiveHour;
  const sevenDay = snapshot.codex.sevenDay;
  const fiveText = formatStatusWindowPercent(fiveHour, settings.statusFormat);
  const sevenText = formatStatusWindowPercent(sevenDay, settings.statusFormat);
  const overWarning =
    (fiveHour?.usedPercent ?? 0) >= settings.warnAtPercent ||
    (sevenDay?.usedPercent ?? 0) >= settings.warnAtPercent;
  const overLimit = (fiveHour?.usedPercent ?? 0) >= 100 || (sevenDay?.usedPercent ?? 0) >= 100;

  return {
    text: `$(pulse) Codex: 5h ${fiveText} · 7d ${sevenText}`,
    tooltip: buildTooltip(snapshot, settings),
    color: overWarning ? new vscode.ThemeColor("statusBarItem.warningForeground") : undefined,
    backgroundColor: overLimit
      ? new vscode.ThemeColor("statusBarItem.errorBackground")
      : overWarning
        ? new vscode.ThemeColor("statusBarItem.warningBackground")
        : undefined,
    accessibilityLabel: `Codex usage: 5 hour ${fiveText}, 7 day ${sevenText}`
  };
}

export function buildUsageQuickPickItems(
  snapshot: NormalizedUsageSnapshot,
  settings: ExtensionSettings
): UsageQuickPickItem[] {
  const buckets = settings.showExtraBuckets ? snapshot.buckets : [snapshot.codex];
  const items: UsageQuickPickItem[] = [];

  items.push({
    label: "$(graph) Account Summary",
    description: snapshot.codex.planType ? `Plan: ${snapshot.codex.planType}` : undefined,
    detail: [
      `Reset credits: ${snapshot.resetCredits?.availableCount ?? "unknown"}`,
      snapshot.codex.credits
        ? `Credits: ${snapshot.codex.credits.unlimited ? "unlimited" : snapshot.codex.credits.balance ?? "unknown"}`
        : null,
      snapshot.tokenUsage?.summary
        ? `Lifetime tokens: ${formatInteger(snapshot.tokenUsage.summary.lifetimeTokens)}`
        : null,
      snapshot.tokenUsage?.summary
        ? `Peak daily tokens: ${formatInteger(snapshot.tokenUsage.summary.peakDailyTokens)}`
        : null,
      snapshot.tokenUsage?.summary
        ? `Current streak: ${formatInteger(snapshot.tokenUsage.summary.currentStreakDays)} days`
        : null,
      snapshot.tokenUsage?.dailyUsageBuckets
        ? `Last 7 days tokens: ${formatRecentTokenTotal(snapshot.tokenUsage.dailyUsageBuckets)}`
        : null,
      snapshot.tokenUsage?.dailyUsageBuckets
        ? `Recent daily tokens:\n${formatRecentDailyUsage(snapshot.tokenUsage.dailyUsageBuckets)}`
        : null,
      `Last refreshed: ${snapshot.fetchedAt.toLocaleString()}`
    ].filter((item): item is string => Boolean(item)).join("\n")
  });

  for (const bucket of buckets) {
    items.push({
      label: bucket.isPrimaryCodex ? "$(pulse) Codex" : `$(symbol-misc) ${bucket.name}`,
      description: formatBucketSummary(bucket),
      detail: formatBucketDetail(bucket)
    });
  }

  if ((snapshot.resetCredits?.availableCount ?? 0) > 0) {
    items.push({
      label: "$(debug-restart) Use Reset Credit",
      description: `${snapshot.resetCredits?.availableCount} available`,
      detail: "Reset your current Codex rate-limit window. This asks for confirmation before consuming a credit.",
      action: "resetUsage"
    });
  } else {
    items.push({
      label: "$(debug-restart) Use Reset Credit",
      description: "No reset credits available",
      detail: "Codex reported no reset credits for this account."
    });
  }

  items.push({
    label: "$(sync) Refresh",
    description: "Read Codex usage again",
    action: "refresh"
  });

  items.push({
    label: "$(output) Open Logs",
    description: "Show the Codex Usage Status output channel",
    action: "openLogs"
  });

  return items;
}

function buildTooltip(snapshot: NormalizedUsageSnapshot, settings: ExtensionSettings): vscode.MarkdownString {
  const tooltip = new vscode.MarkdownString(undefined, true);
  tooltip.isTrusted = false;
  tooltip.supportHtml = false;
  tooltip.appendMarkdown("### Codex Usage\n\n");
  tooltip.appendMarkdown(formatBucketMarkdown(snapshot.codex, true));

  if (settings.showExtraBuckets) {
    for (const bucket of snapshot.buckets.filter((item) => !item.isPrimaryCodex)) {
      tooltip.appendMarkdown("\n\n---\n\n");
      tooltip.appendMarkdown(formatBucketMarkdown(bucket, false));
    }
  }

  tooltip.appendMarkdown("\n\n---\n\n");
  tooltip.appendMarkdown("**Account**\n\n");
  tooltip.appendMarkdown("| Field | Value |\n| --- | --- |\n");

  if (snapshot.codex.planType) {
    tooltip.appendMarkdown(`| Plan | \`${escapeTableCell(snapshot.codex.planType)}\` |\n`);
  }

  if (snapshot.codex.credits) {
    const balance = snapshot.codex.credits.unlimited ? "unlimited" : snapshot.codex.credits.balance ?? "unknown";
    tooltip.appendMarkdown(`| Credits | \`${escapeTableCell(balance)}\` |\n`);
  }

  tooltip.appendMarkdown(`| Reset credits | \`${snapshot.resetCredits?.availableCount ?? "unknown"}\` |\n`);

  if (snapshot.tokenUsage?.summary) {
    tooltip.appendMarkdown(
      `| Lifetime tokens | \`${escapeTableCell(formatInteger(snapshot.tokenUsage.summary.lifetimeTokens))}\` |\n`
    );
    tooltip.appendMarkdown(
      `| Peak daily tokens | \`${escapeTableCell(formatInteger(snapshot.tokenUsage.summary.peakDailyTokens))}\` |\n`
    );
    tooltip.appendMarkdown(
      `| Current streak | \`${escapeTableCell(formatInteger(snapshot.tokenUsage.summary.currentStreakDays))} days\` |\n`
    );
  }

  if (snapshot.tokenUsage?.dailyUsageBuckets) {
    tooltip.appendMarkdown(
      `| Last 7 days tokens | \`${escapeTableCell(formatRecentTokenTotal(snapshot.tokenUsage.dailyUsageBuckets))}\` |\n`
    );
  }

  tooltip.appendMarkdown(`\n\n_Last refreshed ${snapshot.fetchedAt.toLocaleString()}_`);
  return tooltip;
}

function formatBucketMarkdown(bucket: NormalizedUsageBucket, primary: boolean): string {
  const lines = [
    primary ? "**Primary bucket**" : `**${escapeMarkdown(bucket.name)}**`,
    "",
    "| Window | Used | Resets |",
    "| --- | ---: | --- |",
    `| 5 hours | \`${formatWindowPercent(bucket.fiveHour)}\` | ${formatResetCell(bucket.fiveHour)} |`,
    `| 7 days | \`${formatWindowPercent(bucket.sevenDay)}\` | ${formatResetCell(bucket.sevenDay)} |`
  ];

  return lines.join("\n");
}

function formatBucketDetail(bucket: NormalizedUsageBucket): string {
  const lines = [
    `5-hour: ${formatWindowLine(bucket.fiveHour)}`,
    `7-day: ${formatWindowLine(bucket.sevenDay)}`
  ];

  if (bucket.planType) {
    lines.push(`Plan: ${bucket.planType}`);
  }

  if (bucket.credits) {
    const balance = bucket.credits.unlimited ? "unlimited" : bucket.credits.balance ?? "unknown";
    lines.push(`Credits: ${balance}`);
  }

  return lines.join("\n");
}

function formatStatusWindowPercent(window: RateLimitWindow | null, format: ExtensionSettings["statusFormat"]): string {
  if (!window) {
    return "?";
  }

  if (format === "remaining") {
    return formatWindowRemaining(window);
  }

  return formatWindowPercent(window);
}

function formatResetCell(window: RateLimitWindow | null): string {
  return window?.resetsAt ? `\`${escapeTableCell(formatResetShort(window.resetsAt))}\`` : "`unknown`";
}

function escapeTableCell(value: string): string {
  return value.replace(/\|/g, "\\|");
}

function escapeMarkdown(value: string): string {
  return value.replace(/([\\`*_{}\[\]()#+\-.!])/g, "\\$1");
}
