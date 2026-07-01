import { formatResetShort } from "./formatCore";
import type { NormalizedUsageSnapshot, RateLimitWindow } from "./types";

export type UsageAlertKind = "warning" | "limit";

export interface UsageAlert {
  key: string;
  kind: UsageAlertKind;
  label: string;
  usedPercent: number;
  resetsAt: number | null;
}

export interface UsageAlertEvaluation {
  alerts: UsageAlert[];
  activeKeys: Set<string>;
}

export function evaluateUsageAlerts(
  snapshot: NormalizedUsageSnapshot,
  warnAtPercent: number,
  previousActiveKeys: ReadonlySet<string>
): UsageAlertEvaluation {
  const activeKeys = new Set<string>();
  const alerts: UsageAlert[] = [];
  const windows: Array<{ id: string; label: string; window: RateLimitWindow | null }> = [
    { id: "fiveHour", label: "5-hour", window: snapshot.codex.fiveHour },
    { id: "sevenDay", label: "7-day", window: snapshot.codex.sevenDay }
  ];

  for (const item of windows) {
    const window = item.window;
    if (!window) {
      continue;
    }
    const usedPercent = window.usedPercent;

    const warningKey = `${item.id}:warning:${warnAtPercent}`;
    const limitKey = `${item.id}:limit`;

    if (usedPercent >= warnAtPercent) {
      activeKeys.add(warningKey);
    }

    if (usedPercent >= 100) {
      activeKeys.add(limitKey);
      if (!previousActiveKeys.has(limitKey)) {
        alerts.push(buildAlert(limitKey, "limit", item.label, window));
      }
      continue;
    }

    if (usedPercent >= warnAtPercent && !previousActiveKeys.has(warningKey)) {
      alerts.push(buildAlert(warningKey, "warning", item.label, window));
    }
  }

  return { alerts, activeKeys };
}

export function formatUsageAlertMessage(alerts: UsageAlert[]): string {
  const prefix = alerts.some((alert) => alert.kind === "limit")
    ? "Codex usage limit reached"
    : "Codex usage is high";
  const details = alerts.map((alert) => {
    const reset = alert.resetsAt ? `, resets ${formatResetShort(alert.resetsAt)}` : "";
    return `${alert.label} ${alert.usedPercent}%${reset}`;
  });

  return `${prefix}: ${details.join("; ")}.`;
}

function buildAlert(
  key: string,
  kind: UsageAlertKind,
  label: string,
  window: RateLimitWindow
): UsageAlert {
  return {
    key,
    kind,
    label,
    usedPercent: window.usedPercent,
    resetsAt: window.resetsAt
  };
}
