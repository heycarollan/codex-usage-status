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
