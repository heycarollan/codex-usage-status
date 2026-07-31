import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  createSharedAppServerEndpoint,
  isSharedAppServerSupported
} from "../src/sharedAppServer";

test("recognizes platforms supported by the private shared socket", () => {
  assert.equal(isSharedAppServerSupported("linux"), true);
  assert.equal(isSharedAppServerSupported("darwin"), true);
  assert.equal(isSharedAppServerSupported("win32"), false);
});

test("creates and cleans a private shared app-server endpoint", {
  skip: process.platform === "win32"
}, () => {
  const root = mkdtempSync(join(tmpdir(), "codex-companion-shared-endpoint-test-"));
  try {
    const endpoint = createSharedAppServerEndpoint(root);
    assert.equal(statSync(endpoint.directory).mode & 0o777, 0o700);
    assert.equal(endpoint.listenUrl, `unix://${endpoint.socketPath}`);
    assert.equal(endpoint.websocketUrl, `ws+unix://${endpoint.socketPath}:/rpc`);

    endpoint.cleanup();
    assert.equal(existsSync(endpoint.directory), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
