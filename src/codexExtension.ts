import { existsSync } from "node:fs";
import * as vscode from "vscode";
import {
  ensureCodexExecutableExists,
  resolveCodexExtensionExecutable,
} from "./codexExtensionExecutable";

const CODEX_EXTENSION_ID = "openai.chatgpt";

export function getCodexExecutablePathFromExtension(): string {
  const extension = vscode.extensions.getExtension(CODEX_EXTENSION_ID);
  const executable = resolveCodexExtensionExecutable(
    extension?.extensionPath,
    process.platform,
    process.arch,
  );

  return ensureCodexExecutableExists(executable, existsSync);
}
