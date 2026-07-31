import {
  chmodSync,
  lstatSync,
  mkdtempSync,
  rmdirSync,
  unlinkSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface SharedAppServerEndpoint {
  readonly directory: string;
  readonly socketPath: string;
  readonly listenUrl: string;
  readonly websocketUrl: string;
  cleanup(): void;
}

export function isSharedAppServerSupported(platform = process.platform): boolean {
  return platform !== "win32";
}

export function createSharedAppServerEndpoint(
  runtimeRoot = tmpdir()
): SharedAppServerEndpoint {
  if (!isSharedAppServerSupported()) {
    throw new Error("The shared Codex host currently requires Linux or macOS.");
  }

  const userId = typeof process.getuid === "function" ? process.getuid() : "user";
  const directory = mkdtempSync(join(runtimeRoot, `codex-companion-${userId}-`));
  chmodSync(directory, 0o700);
  const socketPath = join(directory, "app-server.sock");

  return {
    directory,
    socketPath,
    listenUrl: `unix://${socketPath}`,
    websocketUrl: `ws+unix://${socketPath}:/rpc`,
    cleanup() {
      removeOwnedSocket(socketPath);
      removeEmptyDirectory(directory);
    }
  };
}

function removeOwnedSocket(socketPath: string): void {
  try {
    if (lstatSync(socketPath).isSocket()) {
      unlinkSync(socketPath);
    }
  } catch (error) {
    if (!isMissingPathError(error)) {
      return;
    }
  }
}

function removeEmptyDirectory(directory: string): void {
  try {
    rmdirSync(directory);
  } catch (error) {
    if (!isMissingPathError(error)) {
      return;
    }
  }
}

function isMissingPathError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
