import { createHash, randomBytes } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  renameSync,
  rmdirSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

interface RemoteControlLeaseOwner {
  pid: number;
  token: string;
  appServerPid?: number;
  appServerToken?: string;
}

export interface RemoteControlAppServerProcess {
  pid: number;
  token: string;
}

export interface RemoteControlHostLeaseOptions {
  lockPath?: string;
  processId?: number;
  token?: string;
  processExists?: (pid: number) => boolean;
  terminateAppServer?: (process: RemoteControlAppServerProcess) => boolean;
}

export class RemoteControlHostLease {
  private readonly lockPath: string;
  private readonly ownerPath: string;
  private readonly processId: number;
  private readonly token: string;
  private readonly processExists: (pid: number) => boolean;
  private readonly terminateAppServer: ((process: RemoteControlAppServerProcess) => boolean) | null;
  private acquired = false;

  constructor(options: RemoteControlHostLeaseOptions = {}) {
    this.lockPath = options.lockPath ?? defaultRemoteControlLockPath();
    this.ownerPath = join(this.lockPath, "owner.json");
    this.processId = options.processId ?? process.pid;
    this.token = options.token ?? randomBytes(18).toString("hex");
    this.processExists = options.processExists ?? isProcessAlive;
    this.terminateAppServer = options.terminateAppServer ?? null;
  }

  get owned(): boolean {
    return this.acquired;
  }

  tryAcquire(): boolean {
    if (this.acquired) {
      return true;
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        mkdirSync(this.lockPath, { mode: 0o700 });
        writeFileSync(
          this.ownerPath,
          JSON.stringify({ pid: this.processId, token: this.token }),
          { encoding: "utf8", mode: 0o600, flag: "wx" }
        );
        this.acquired = true;
        return true;
      } catch (error) {
        if (!isNodeError(error, "EEXIST")) {
          this.removeIncompleteLease();
          return false;
        }
      }

      const owner = this.readOwner();
      if (!owner || this.processExists(owner.pid)) {
        return false;
      }

      if (owner.appServerPid && owner.appServerToken) {
        this.terminateAppServer?.({
          pid: owner.appServerPid,
          token: owner.appServerToken
        });
      }

      const stalePath = `${this.lockPath}.stale-${this.processId}-${this.token}`;
      try {
        renameSync(this.lockPath, stalePath);
        removeLeaseDirectory(stalePath);
      } catch (error) {
        if (!isNodeError(error, "ENOENT") && !isNodeError(error, "EEXIST")) {
          return false;
        }
      }
    }

    return false;
  }

  recordAppServerProcess(process: RemoteControlAppServerProcess | null): void {
    if (!this.acquired) {
      return;
    }

    const owner = this.readOwner();
    if (owner?.pid !== this.processId || owner.token !== this.token) {
      this.acquired = false;
      return;
    }

    writeFileSync(
      this.ownerPath,
      JSON.stringify({
        pid: this.processId,
        token: this.token,
        ...(process ? {
          appServerPid: process.pid,
          appServerToken: process.token
        } : {})
      }),
      { encoding: "utf8", mode: 0o600 }
    );
  }

  release(): void {
    if (!this.acquired) {
      return;
    }

    this.acquired = false;
    const owner = this.readOwner();
    if (owner?.pid !== this.processId || owner.token !== this.token) {
      return;
    }

    removeLeaseDirectory(this.lockPath);
  }

  dispose(): void {
    this.release();
  }

  private readOwner(): RemoteControlLeaseOwner | null {
    try {
      const value = JSON.parse(readFileSync(this.ownerPath, "utf8")) as Partial<RemoteControlLeaseOwner>;
      const appServerPid = value.appServerPid;
      const appServerToken = value.appServerToken;
      return typeof value.pid === "number" && Number.isSafeInteger(value.pid) && value.pid > 0 &&
        typeof value.token === "string" && value.token.length > 0
        ? {
            pid: value.pid,
            token: value.token,
            ...(typeof appServerPid === "number" && Number.isSafeInteger(appServerPid) && appServerPid > 0 &&
            typeof appServerToken === "string" && appServerToken.length > 0
              ? { appServerPid, appServerToken }
              : {})
          }
        : null;
    } catch {
      return null;
    }
  }

  private removeIncompleteLease(): void {
    try {
      rmdirSync(this.lockPath);
    } catch {
      // Another process owns the directory, or the directory is no longer empty.
    }
  }
}

export function defaultRemoteControlLockPath(): string {
  const userKey = typeof process.getuid === "function"
    ? String(process.getuid())
    : createHash("sha256").update(homedir()).digest("hex").slice(0, 16);
  return join(tmpdir(), `codex-companion-remote-control-${userKey}.lock`);
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return isNodeError(error, "EPERM");
  }
}

function removeLeaseDirectory(path: string): void {
  try {
    unlinkSync(join(path, "owner.json"));
  } catch (error) {
    if (!isNodeError(error, "ENOENT")) {
      return;
    }
  }

  try {
    rmdirSync(path);
  } catch {
    // A concurrent owner or unexpected file keeps the directory intact.
  }
}

function isNodeError(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === code;
}
