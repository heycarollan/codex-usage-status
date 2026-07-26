import { existsSync } from "node:fs";
import * as vscode from "vscode";
import { resolveCodexExtensionExecutable } from "./codexExtensionExecutable";

const CODEX_EXTENSION_ID = "openai.chatgpt";

export function getCodexExecutablePathFromExtension(): string {
  const extension = vscode.extensions.getExtension(CODEX_EXTENSION_ID);
  const executable = resolveCodexExtensionExecutable(
    extension?.extensionPath,
    process.platform,
    process.arch,
  );

  if (!existsSync(executable)) {
    throw new Error(
      `The Codex binary was not found in the official extension at ${executable}. ` +
        "Update the official Codex extension or configure codexUsage.codexExecutable instead.",
    );
  }

  return executable;
}
