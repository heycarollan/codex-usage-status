export type JsonRpcId = number;

export interface JsonRpcResponse<T> {
  id: JsonRpcId;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface RateLimitWindow {
  usedPercent: number;
  windowDurationMins: number | null;
  resetsAt: number | null;
}

export interface CreditsSnapshot {
  hasCredits: boolean;
  unlimited: boolean;
  balance: string | null;
}

export interface SpendControlLimitSnapshot {
  limit: string;
  used: string;
  remainingPercent: number;
  resetsAt: number;
}

export type RateLimitResetType = "codexRateLimits" | "unknown";
export type RateLimitResetCreditStatus = "available" | "redeeming" | "redeemed" | "unknown";

export interface RateLimitResetCredit {
  id: string;
  resetType: RateLimitResetType;
  status: RateLimitResetCreditStatus;
  grantedAt: number;
  expiresAt: number | null;
  title: string | null;
  description: string | null;
}

export interface RateLimitResetCreditsSummary {
  availableCount: number;
  // Older Codex app-server versions returned only availableCount.
  credits?: RateLimitResetCredit[] | null;
}

export type PlanType =
  | "free"
  | "go"
  | "plus"
  | "pro"
  | "prolite"
  | "team"
  | "self_serve_business_usage_based"
  | "business"
  | "enterprise_cbp_usage_based"
  | "enterprise"
  | "edu"
  | "unknown";

export interface RateLimitSnapshot {
  limitId: string | null;
  limitName: string | null;
  primary: RateLimitWindow | null;
  secondary: RateLimitWindow | null;
  credits: CreditsSnapshot | null;
  individualLimit: SpendControlLimitSnapshot | null;
  planType: PlanType | null;
  rateLimitReachedType: string | null;
}

export interface GetAccountRateLimitsResponse {
  rateLimits: RateLimitSnapshot;
  rateLimitsByLimitId: Record<string, RateLimitSnapshot | undefined> | null;
  rateLimitResetCredits: RateLimitResetCreditsSummary | null;
}

export interface AccountTokenUsageSummary {
  lifetimeTokens: number | null;
  peakDailyTokens: number | null;
  longestRunningTurnSec: number | null;
  currentStreakDays: number | null;
  longestStreakDays: number | null;
}

export interface AccountTokenUsageDailyBucket {
  startDate: string;
  tokens: number;
}

export interface GetAccountTokenUsageResponse {
  summary: AccountTokenUsageSummary;
  dailyUsageBuckets: AccountTokenUsageDailyBucket[] | null;
}

export type ConsumeAccountRateLimitResetCreditOutcome =
  | "reset"
  | "nothingToReset"
  | "noCredit"
  | "alreadyRedeemed";

export interface ConsumeAccountRateLimitResetCreditResponse {
  outcome: ConsumeAccountRateLimitResetCreditOutcome;
}

export interface NormalizedUsageBucket {
  id: string;
  name: string;
  isPrimaryCodex: boolean;
  fiveHour: RateLimitWindow | null;
  sevenDay: RateLimitWindow | null;
  planType: PlanType | null;
  credits: CreditsSnapshot | null;
  individualLimit: SpendControlLimitSnapshot | null;
  rateLimitReachedType: string | null;
}

export interface NormalizedUsageSnapshot {
  codex: NormalizedUsageBucket;
  buckets: NormalizedUsageBucket[];
  resetCredits: RateLimitResetCreditsSummary | null;
  tokenUsage: GetAccountTokenUsageResponse | null;
  fetchedAt: Date;
}

export interface ExtensionSettings {
  codexExecutableSource: "path" | "extension";
  refreshIntervalSeconds: number;
  codexExecutable: string;
  showExtraBuckets: boolean;
  statusFormat: "compact" | "remaining";
  warnAtPercent: number;
  requestTimeoutMs: number;
  notifyUsageWarnings: boolean;
  notifyTurnComplete: boolean;
  notifyNeedsInput: boolean;
  notificationMode: "native" | "vscode" | "both";
  completionChatAction: "exact" | "sidebar" | "none";
}
