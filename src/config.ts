import * as vscode from "vscode";
import type { ExtensionSettings } from "./types";

export function getSettings(): ExtensionSettings {
  const config = vscode.workspace.getConfiguration("codexUsage");

  return {
    refreshIntervalSeconds: config.get("refreshIntervalSeconds", 10),
    codexExecutable: config.get("codexExecutable", "codex"),
    showExtraBuckets: config.get("showExtraBuckets", true),
    statusFormat: config.get("statusFormat", "compact"),
    warnAtPercent: config.get("warnAtPercent", 90),
    requestTimeoutMs: config.get("requestTimeoutMs", 12000),
    notifyUsageWarnings: config.get("notifyUsageWarnings", true),
    notifyTurnComplete: config.get("notifyTurnComplete", true),
    notifyNeedsInput: config.get("notifyNeedsInput", true),
    notificationMode: config.get("notificationMode", "native")
  };
}
