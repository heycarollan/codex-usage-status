import { type PathLike } from 'node:fs';
import { join } from "node:path";

const CODEX_EXTENSION_ID = "openai.chatgpt";

export function resolveCodexExtensionExecutable(
  extensionPath: string | undefined,
  platform: NodeJS.Platform,
  arch: string,
): string {
  if (!extensionPath) {
    throw new Error(
      `The official Codex extension (${CODEX_EXTENSION_ID}) is not installed or enabled. ` +
        "Install it or set Codex Usage Status: Codex Executable Source to Path.",
    );
  }

  const platformDirectories: Partial<Record<NodeJS.Platform, string>> = {
    win32: "windows",
    linux: "linux",
    darwin: "darwin",
  };
  const architectureDirectories: Record<string, string | undefined> = {
    x64: "x86_64",
    arm64: "aarch64",
  };
  const platformDirectory = platformDirectories[platform];
  const architectureDirectory = architectureDirectories[arch];

  if (!platformDirectory || !architectureDirectory) {
    throw new Error(
      `The official Codex extension binary is not supported on ${platform}/${arch}. ` +
        "Configure codexUsage.codexExecutable instead.",
    );
  }

  return join(
    extensionPath,
    "bin",
    `${platformDirectory}-${architectureDirectory}`,
    platform === "win32" ? "codex.exe" : "codex",
  );
}

export function ensureCodexExecutableExists(
  executable: string,
  fileExists: (path: PathLike) => boolean,
): string {
  if (!fileExists(executable)) {
    throw new Error(
      `The Codex binary was not found in the official extension at ${executable}. ` +
        "Update the official Codex extension or configure codexUsage.codexExecutable instead.",
    );
  }

  return executable;
}
