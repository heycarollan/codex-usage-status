import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import {
  ensureCodexExecutableExists,
  resolveCodexExtensionExecutable,
} from "../src/codexExtensionExecutable";

const cases: Array<{
  name: string;
  platform: NodeJS.Platform;
  arch: string;
  directory: string;
  executable: string;
}> = [
  {
    name: "Linux x64",
    platform: "linux",
    arch: "x64",
    directory: "linux-x86_64",
    executable: "codex",
  },
  {
    name: "Linux ARM64",
    platform: "linux",
    arch: "arm64",
    directory: "linux-aarch64",
    executable: "codex",
  },
  {
    name: "Windows x64",
    platform: "win32",
    arch: "x64",
    directory: "windows-x86_64",
    executable: "codex.exe",
  },
  {
    name: "Windows ARM64",
    platform: "win32",
    arch: "arm64",
    directory: "windows-aarch64",
    executable: "codex.exe",
  },
  {
    name: "macOS x64",
    platform: "darwin",
    arch: "x64",
    directory: "darwin-x86_64",
    executable: "codex",
  },
  {
    name: "macOS ARM64",
    platform: "darwin",
    arch: "arm64",
    directory: "darwin-aarch64",
    executable: "codex",
  },
];

for (const testCase of cases) {
  test(`resolves the bundled executable for ${testCase.name}`, () => {
    const extensionPath = join("extensions", "openai.chatgpt");
    const expected = join(
      extensionPath,
      "bin",
      testCase.directory,
      testCase.executable,
    );

    assert.equal(
      resolveCodexExtensionExecutable(
        extensionPath,
        testCase.platform,
        testCase.arch,
      ),
      expected,
    );
  });
}

test("reports a missing Codex extension", () => {
  assert.throws(() =>
    resolveCodexExtensionExecutable(undefined, "linux", "x64"),
  );
});

test("reports a missing executable file in Codex extension", () => {
  assert.throws(() =>
    ensureCodexExecutableExists(
      "/fake/openai.chatgpt/bin/linux-x86_64/codex",
      () => false,
    ),
  );
});
