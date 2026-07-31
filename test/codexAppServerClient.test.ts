import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  CodexAppServerClient,
  parseThreadSnapshot,
  parseTurnCompletedEvent
} from "../src/codexAppServerClient";

test("restarts one app-server at a time and shuts Remote down ephemerally", {
  skip: process.platform === "win32"
}, async () => {
  const root = mkdtempSync(join(tmpdir(), "codex-companion-app-server-test-"));
  const executable = join(root, "fake-codex");
  const lifecycleLog = join(root, "lifecycle.log");
  const script = `#!/usr/bin/env node
const fs = require("node:fs");
const readline = require("node:readline");
const logPath = ${JSON.stringify(lifecycleLog)};
fs.appendFileSync(logPath, "start\\n");
let stopped = false;
function stop() {
  if (stopped) return;
  stopped = true;
  fs.appendFileSync(logPath, "stop\\n");
  process.exit(0);
}
process.on("SIGTERM", stop);
const input = readline.createInterface({ input: process.stdin });
input.on("close", stop);
input.on("line", (line) => {
  const message = JSON.parse(line);
  if (typeof message.id !== "number") return;
  if (message.method === "initialize") {
    process.stdout.write(JSON.stringify({ id: message.id, result: {} }) + "\\n");
    return;
  }
  if (message.method === "remoteControl/status/read") {
    process.stdout.write(JSON.stringify({ id: message.id, result: {
      status: "disabled", serverName: "test-host", installationId: null, environmentId: null
    } }) + "\\n");
    return;
  }
  if (message.method === "remoteControl/disable") {
    fs.appendFileSync(logPath, "disable:" + String(message.params?.ephemeral) + "\\n");
    process.stdout.write(JSON.stringify({ id: message.id, result: {
      status: "disabled", serverName: "test-host", installationId: null, environmentId: null
    } }) + "\\n");
    return;
  }
  process.stdout.write(JSON.stringify({ id: message.id, error: { code: -32601, message: "unsupported" } }) + "\\n");
});
`;
  writeFileSync(executable, script, "utf8");
  chmodSync(executable, 0o755);

  const messages: string[] = [];
  const client = new CodexAppServerClient(executable, 2_000, {
    appendLine(message) {
      messages.push(message);
    }
  });

  try {
    assert.equal((await client.getRemoteControlStatus()).status, "disabled");
    await client.restart();
    assert.equal((await client.getRemoteControlStatus()).status, "disabled");
    await client.shutdown();

    const lifecycle = readFileSync(lifecycleLog, "utf8").trim().split("\n");
    assert.equal(lifecycle.filter((line) => line === "start").length, 2);
    assert.equal(lifecycle.filter((line) => line === "stop").length, 2);
    assert.equal(lifecycle.filter((line) => line === "disable:true").length, 2);
    assert.equal(messages.some((message) => /request .* cancelled|restart failed/i.test(message)), false);
  } finally {
    await client.shutdown();
    rmSync(root, { recursive: true, force: true });
  }
});

test("parses turn completion notifications", () => {
  const event = parseTurnCompletedEvent({
    threadId: "thread-1",
    turn: {
      id: "turn-1",
      status: "completed",
      durationMs: 1234,
      completedAt: 1710000000
    }
  });

  assert.deepEqual(event, {
    threadId: "thread-1",
    turnId: "turn-1",
    status: "completed",
    durationMs: 1234,
    completedAt: 1710000000
  });
});

test("parses snake case turn completion notifications", () => {
  const event = parseTurnCompletedEvent({
    thread_id: "thread-2",
    turn_id: "turn-2",
    status: { type: "failed" },
    duration_ms: 900,
    completed_at: 1710000001
  });

  assert.deepEqual(event, {
    threadId: "thread-2",
    turnId: "turn-2",
    status: "failed",
    durationMs: 900,
    completedAt: 1710000001
  });
});

test("parses completed turns from thread snapshots", () => {
  const thread = parseThreadSnapshot({
    id: "thread-3",
    turns: [
      {
        id: "turn-3",
        status: "completed",
        completedAt: 1710000002,
        durationMs: 2500
      },
      {
        id: "turn-4",
        status: "running",
        completedAt: null,
        durationMs: null
      },
      {
        status: "completed"
      }
    ]
  });

  assert.deepEqual(thread, {
    id: "thread-3",
    name: null,
    cwd: null,
    gitBranch: null,
    source: null,
    turns: [
      {
        id: "turn-3",
        status: "completed",
        completedAt: 1710000002,
        durationMs: 2500
      },
      {
        id: "turn-4",
        status: "running",
        completedAt: null,
        durationMs: null
      }
    ]
  });
});

test("parses chat identity from thread snapshots", () => {
  const thread = parseThreadSnapshot({
    id: "thread-4",
    name: "Investigate notifications",
    cwd: "/workspace/codex-usage-status",
    source: "vscode",
    gitInfo: {
      branch: "feature/notifications"
    },
    turns: []
  });

  assert.deepEqual(thread, {
    id: "thread-4",
    name: "Investigate notifications",
    cwd: "/workspace/codex-usage-status",
    gitBranch: "feature/notifications",
    source: "vscode",
    turns: []
  });
});
