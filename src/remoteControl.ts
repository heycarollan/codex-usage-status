export type RemoteControlConnectionStatus =
  | "disabled"
  | "connecting"
  | "connected"
  | "errored";

export interface RemoteControlStatusSnapshot {
  status: RemoteControlConnectionStatus;
  serverName: string;
  installationId: string | null;
  environmentId: string | null;
}

export interface RemoteControlPairingArtifact {
  pairingCode: string;
  manualPairingCode: string;
  environmentId: string;
  expiresAt: number;
}

export interface RemoteControlClientDevice {
  clientId: string;
  displayName: string | null;
  deviceType: string | null;
  platform: string | null;
  osVersion: string | null;
  deviceModel: string | null;
  appVersion: string | null;
  lastSeenAt: number | null;
}

export interface RemoteControlClientList {
  data: RemoteControlClientDevice[];
  nextCursor: string | null;
}

export interface RemoteControlStatusBarPresentation {
  text: string;
  tooltip: string;
  accessibilityLabel: string;
  warning: boolean;
}

export interface RemoteControlStatusBarState {
  supported: boolean;
  busy: boolean;
  status: RemoteControlConnectionStatus | null;
  errorMessage: string | null;
  onboardingHighlighted: boolean;
}

export function parseRemoteControlStatus(value: unknown): RemoteControlStatusSnapshot {
  const record = asRecord(value);
  const status = readStatus(record.status);
  const serverName = readRequiredString(record.serverName, "remote-control server name");

  return {
    status,
    serverName,
    installationId: readOptionalString(record.installationId),
    environmentId: readOptionalString(record.environmentId)
  };
}

export function parseRemoteControlPairingArtifact(value: unknown): RemoteControlPairingArtifact {
  const record = asRecord(value);
  const manualPairingCode = readRequiredString(
    record.manualPairingCode,
    "manual remote-control pairing code"
  );
  const expiresAt = record.expiresAt;

  if (typeof expiresAt !== "number" || !Number.isFinite(expiresAt) || expiresAt <= 0) {
    throw new Error("Codex returned an invalid remote-control pairing expiration.");
  }

  return {
    pairingCode: readRequiredString(record.pairingCode, "remote-control pairing code"),
    manualPairingCode,
    environmentId: readRequiredString(record.environmentId, "remote-control environment"),
    expiresAt
  };
}

export function parseRemoteControlPairingClaimed(value: unknown): boolean {
  const claimed = asRecord(value).claimed;
  if (typeof claimed !== "boolean") {
    throw new Error("Codex returned an invalid remote-control pairing status.");
  }
  return claimed;
}

export function parseRemoteControlClientList(value: unknown): RemoteControlClientList {
  const record = asRecord(value);
  if (!Array.isArray(record.data)) {
    throw new Error("Codex returned an invalid remote-control device list.");
  }

  return {
    data: record.data.map(parseRemoteControlClient),
    nextCursor: readOptionalString(record.nextCursor)
  };
}

export function isPairingArtifactExpired(
  artifact: RemoteControlPairingArtifact,
  nowMs = Date.now()
): boolean {
  return artifact.expiresAt * 1000 <= nowMs;
}

export function redactRemoteControlSecrets(
  message: string,
  sensitiveValues: ReadonlyArray<string | null | undefined>
): string {
  return sensitiveValues.reduce<string>((redacted, value) => {
    if (!value) {
      return redacted;
    }
    return redacted.split(value).join("[redacted]");
  }, message);
}

export function buildRemoteControlStatusBarPresentation(
  state: RemoteControlStatusBarState
): RemoteControlStatusBarPresentation {
  if (state.onboardingHighlighted) {
    return {
      text: "$(remote) Set up Remote",
      tooltip: "New: set up full Codex Remote access from ChatGPT. Click to open the guided setup.",
      accessibilityLabel: "Set up Codex Remote access",
      warning: true
    };
  }

  if (state.busy || state.status === "connecting") {
    return {
      text: "$(sync~spin) Remote",
      tooltip: "Codex Remote is connecting. Click to open Remote Control settings.",
      accessibilityLabel: "Codex Remote is connecting",
      warning: false
    };
  }

  if (!state.supported) {
    return {
      text: "$(warning) Remote",
      tooltip: state.errorMessage ?? "This Codex executable does not support Remote Control.",
      accessibilityLabel: "Codex Remote is unavailable",
      warning: true
    };
  }

  if (state.status === "connected") {
    return {
      text: "$(remote) Remote: On",
      tooltip: "Codex Remote is connected through OpenAI's relay. Click to manage access and paired devices.",
      accessibilityLabel: "Codex Remote is connected",
      warning: false
    };
  }

  if (state.status === "errored" || state.errorMessage) {
    return {
      text: "$(warning) Remote",
      tooltip: state.errorMessage ?? "Codex Remote could not connect. Click to review setup.",
      accessibilityLabel: "Codex Remote has a connection error",
      warning: true
    };
  }

  return {
    text: "$(remote) Remote",
    tooltip: "Codex Remote is off. Click to pair this computer with ChatGPT Remote.",
    accessibilityLabel: "Codex Remote is off; click to set it up",
    warning: false
  };
}

function parseRemoteControlClient(value: unknown): RemoteControlClientDevice {
  const record = asRecord(value);
  const lastSeenAt = record.lastSeenAt;

  return {
    clientId: readRequiredString(record.clientId, "remote-control client id"),
    displayName: readOptionalString(record.displayName),
    deviceType: readOptionalString(record.deviceType),
    platform: readOptionalString(record.platform),
    osVersion: readOptionalString(record.osVersion),
    deviceModel: readOptionalString(record.deviceModel),
    appVersion: readOptionalString(record.appVersion),
    lastSeenAt:
      typeof lastSeenAt === "number" && Number.isFinite(lastSeenAt) && lastSeenAt > 0
        ? lastSeenAt
        : null
  };
}

function readStatus(value: unknown): RemoteControlConnectionStatus {
  if (value === "disabled" || value === "connecting" || value === "connected" || value === "errored") {
    return value;
  }
  throw new Error("Codex returned an unknown remote-control status.");
}

function readRequiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Codex returned an invalid ${label}.`);
  }
  return value;
}

function readOptionalString(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}
