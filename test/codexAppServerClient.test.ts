import assert from "node:assert/strict";
import test from "node:test";
import { parseThreadSnapshot, parseTurnCompletedEvent } from "../src/codexAppServerClient";

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
