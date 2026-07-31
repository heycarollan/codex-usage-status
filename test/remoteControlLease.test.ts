import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { RemoteControlHostLease } from "../src/remoteControlLease";

test("allows only one live Remote Control owner", () => {
  const root = mkdtempSync(join(tmpdir(), "codex-companion-lease-test-"));
  const lockPath = join(root, "remote.lock");
  const first = new RemoteControlHostLease({
    lockPath,
    processId: 101,
    token: "first",
    processExists: (pid) => pid === 101
  });
  const second = new RemoteControlHostLease({
    lockPath,
    processId: 202,
    token: "second",
    processExists: (pid) => pid === 101 || pid === 202
  });

  try {
    assert.equal(first.tryAcquire(), true);
    assert.equal(first.tryAcquire(), true);
    assert.equal(second.tryAcquire(), false);
    assert.equal(first.owned, true);
    assert.equal(second.owned, false);

    first.release();
    assert.equal(second.tryAcquire(), true);
  } finally {
    first.release();
    second.release();
    rmSync(root, { recursive: true, force: true });
  }
});

test("reclaims a Remote Control lease after its owner exits", () => {
  const root = mkdtempSync(join(tmpdir(), "codex-companion-stale-lease-test-"));
  const lockPath = join(root, "remote.lock");
  const stale = new RemoteControlHostLease({
    lockPath,
    processId: 303,
    token: "stale",
    processExists: () => false
  });
  const replacement = new RemoteControlHostLease({
    lockPath,
    processId: 404,
    token: "replacement",
    processExists: (pid) => pid === 404
  });

  try {
    assert.equal(stale.tryAcquire(), true);
    assert.equal(replacement.tryAcquire(), true);
    assert.equal(replacement.owned, true);
  } finally {
    replacement.release();
    rmSync(root, { recursive: true, force: true });
  }
});
