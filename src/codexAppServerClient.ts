import { ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import * as readline from "node:readline";
import WebSocket from "ws";
import type {
  ConsumeAccountRateLimitResetCreditResponse,
  GetAccountRateLimitsResponse,
  GetAccountTokenUsageResponse,
  JsonRpcId,
  JsonRpcResponse
} from "./types";
import {
  parseRemoteControlClientList,
  parseRemoteControlPairingArtifact,
  parseRemoteControlPairingClaimed,
  parseRemoteControlStatus,
  redactRemoteControlSecrets,
  type RemoteControlClientList,
  type RemoteControlPairingArtifact,
  type RemoteControlStatusSnapshot
} from "./remoteControl";
import {
  createSharedAppServerEndpoint,
  type SharedAppServerEndpoint
} from "./sharedAppServer";

export interface Logger {
  appendLine(message: string): void;
}

interface PendingRequest<T> {
  resolve(value: T): void;
  reject(error: Error): void;
  timer: NodeJS.Timeout;
}

export interface AppServerEventHandlers {
  onRateLimitsUpdated?(): void;
  onTurnCompleted?(event: CodexTurnCompletedEvent): void;
  onNeedsUserInput?(event: CodexNeedsUserInputEvent): void;
  onRemoteControlStatusChanged?(status: RemoteControlStatusSnapshot): void;
}

export interface CodexAppServerClientOptions {
  sharedHost?: boolean;
  sharedRuntimeRoot?: string;
}

export interface CodexAppServerProcessIdentity {
  readonly pid: number;
  readonly token: string;
}

const APP_SERVER_OWNER_ENV = "CODEX_COMPANION_APP_SERVER_OWNER";

export interface CodexTurnCompletedEvent {
  threadId: string;
  turnId: string | null;
  status: string | null;
  durationMs: number | null;
  completedAt: number | null;
  threadName?: string | null;
  cwd?: string | null;
  gitBranch?: string | null;
  source?: string | null;
}

export interface CodexTurnSnapshot {
  id: string;
  status: string | null;
  durationMs: number | null;
  completedAt: number | null;
}

export interface CodexThreadSnapshot {
  id: string;
  turns: CodexTurnSnapshot[];
  name: string | null;
  cwd: string | null;
  gitBranch: string | null;
  source: string | null;
}

export interface CodexNeedsUserInputEvent {
  method: string;
  threadId: string | null;
  turnId: string | null;
  title: string;
  detail: string | null;
}

export class CodexAppServerClient {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private rl: readline.Interface | null = null;
  private websocket: WebSocket | null = null;
  private nextId = 1;
  private readonly pending = new Map<JsonRpcId, PendingRequest<unknown>>();
  private initializePromise: Promise<void> | null = null;
  private readonly remoteControlSensitiveValues = new Set<string>();
  private readonly sharedEndpoint: SharedAppServerEndpoint | null;
  private readonly processOwnerToken = randomBytes(18).toString("hex");
  private remoteControlConflictDetected = false;

  constructor(
    private readonly codexExecutable: string,
    private readonly requestTimeoutMs: number,
    private readonly logger: Logger,
    private readonly eventHandlers: AppServerEventHandlers = {},
    options: CodexAppServerClientOptions = {}
  ) {
    this.sharedEndpoint = options.sharedHost
      ? createSharedAppServerEndpoint(options.sharedRuntimeRoot)
      : null;
  }

  isSharedHost(): boolean {
    return this.sharedEndpoint !== null;
  }

  getProcessIdentity(): CodexAppServerProcessIdentity | null {
    return this.proc?.pid
      ? { pid: this.proc.pid, token: this.processOwnerToken }
      : null;
  }

  hasRemoteControlConflict(): boolean {
    return this.remoteControlConflictDetected;
  }

  async getSharedHostEndpoint(): Promise<string | null> {
    if (!this.sharedEndpoint) {
      return null;
    }
    await this.ensureInitialized();
    return this.sharedEndpoint.listenUrl;
  }

  async getRateLimits(): Promise<GetAccountRateLimitsResponse> {
    await this.ensureInitialized();
    return this.request<GetAccountRateLimitsResponse>("account/rateLimits/read", null);
  }

  async getTokenUsage(): Promise<GetAccountTokenUsageResponse> {
    await this.ensureInitialized();
    return this.request<GetAccountTokenUsageResponse>("account/usage/read", null);
  }

  async getRemoteControlStatus(): Promise<RemoteControlStatusSnapshot> {
    await this.ensureInitialized();
    return this.rememberRemoteControlStatus(
      parseRemoteControlStatus(await this.request("remoteControl/status/read", {}))
    );
  }

  async enableRemoteControl(ephemeral = false): Promise<RemoteControlStatusSnapshot> {
    await this.ensureInitialized();
    this.remoteControlConflictDetected = false;
    return this.rememberRemoteControlStatus(
      parseRemoteControlStatus(
        await this.request("remoteControl/enable", { ephemeral })
      )
    );
  }

  async disableRemoteControl(ephemeral = false): Promise<RemoteControlStatusSnapshot> {
    await this.ensureInitialized();
    return this.rememberRemoteControlStatus(
      parseRemoteControlStatus(
        await this.request("remoteControl/disable", { ephemeral })
      )
    );
  }

  async startRemoteControlPairing(): Promise<RemoteControlPairingArtifact> {
    await this.ensureInitialized();
    const artifact = parseRemoteControlPairingArtifact(
      await this.request("remoteControl/pairing/start", { manualCode: true })
    );
    this.rememberRemoteControlValues(
      artifact.pairingCode,
      artifact.manualPairingCode,
      artifact.environmentId
    );
    return artifact;
  }

  async isRemoteControlPairingClaimed(pairingCode: string): Promise<boolean> {
    await this.ensureInitialized();
    return parseRemoteControlPairingClaimed(
      await this.request("remoteControl/pairing/status", { pairingCode })
    );
  }

  async listRemoteControlClients(
    environmentId: string,
    cursor?: string
  ): Promise<RemoteControlClientList> {
    await this.ensureInitialized();
    const clients = parseRemoteControlClientList(
      await this.request("remoteControl/client/list", {
        environmentId,
        ...(cursor ? { cursor } : {}),
        limit: 100,
        order: "desc"
      })
    );
    this.rememberRemoteControlValues(
      environmentId,
      ...clients.data.map((client) => client.clientId)
    );
    return clients;
  }

  async revokeRemoteControlClient(environmentId: string, clientId: string): Promise<void> {
    await this.ensureInitialized();
    await this.request("remoteControl/client/revoke", { environmentId, clientId });
  }

  async consumeRateLimitResetCredit(
    idempotencyKey: string,
    creditId?: string
  ): Promise<ConsumeAccountRateLimitResetCreditResponse> {
    await this.ensureInitialized();
    return this.request<ConsumeAccountRateLimitResetCreditResponse>("account/rateLimitResetCredit/consume", {
      idempotencyKey,
      ...(creditId ? { creditId } : {})
    });
  }

  async listRecentThreads(limit: number): Promise<CodexThreadSnapshot[]> {
    await this.ensureInitialized();
    const response = await this.request<{ data?: unknown[] }>("thread/list", { limit });
    const threads = Array.isArray(response.data) ? response.data : [];
    return threads.map(parseThreadSnapshot).filter((thread): thread is CodexThreadSnapshot => thread !== null);
  }

  async readThread(threadId: string): Promise<CodexThreadSnapshot | null> {
    await this.ensureInitialized();
    const response = await this.request<{ data?: unknown[] }>("thread/turns/list", {
      threadId,
      itemsView: "summary"
    });
    const turns = Array.isArray(response.data)
      ? response.data.map(parseTurnSnapshot).filter((turn): turn is CodexTurnSnapshot => turn !== null)
      : [];
    return {
      id: threadId,
      turns,
      name: null,
      cwd: null,
      gitBranch: null,
      source: null
    };
  }

  async restart(): Promise<void> {
    await this.shutdownCurrentProcess(/*cleanupSharedEndpoint*/ false);
    await this.ensureInitialized();
  }

  async shutdown(): Promise<void> {
    await this.shutdownCurrentProcess(/*cleanupSharedEndpoint*/ true);
  }

  private async shutdownCurrentProcess(cleanupSharedEndpoint: boolean): Promise<void> {
    const activeProcess = this.proc;
    const activeInitialization = this.initializePromise;
    if (activeProcess && activeInitialization) {
      try {
        await activeInitialization;
        if (this.proc === activeProcess) {
          await this.disableRemoteControl(/*ephemeral*/ true);
        }
      } catch {
        this.logger.appendLine(
          "Remote control shutdown handshake was unavailable; closing the app-server process."
        );
      }
    }

    await this.stopCurrentProcess(cleanupSharedEndpoint);
  }

  dispose(): void {
    const processToStop = this.detachCurrentProcess();
    if (!processToStop) {
      this.sharedEndpoint?.cleanup();
      return;
    }

    void waitForProcessExit(processToStop).then(() => {
      this.sharedEndpoint?.cleanup();
    });
    terminateProcessTree(processToStop, "SIGTERM");
    setTimeout(() => {
      terminateProcessTree(processToStop, "SIGKILL");
    }, 250);
  }

  private ensureInitialized(): Promise<void> {
    if (!this.initializePromise) {
      this.initializePromise = this.initialize();
    }
    return this.initializePromise;
  }

  private async initialize(): Promise<void> {
    await this.startProcess();

    await this.request("initialize", {
      clientInfo: {
        name: "codex_usage_status_vscode",
        title: "Codex Companion",
        version: "1.2.3"
      },
      capabilities: {
        experimentalApi: true
      }
    });

    this.notify("initialized", {});
  }

  private async startProcess(): Promise<void> {
    if (this.proc) {
      return;
    }

    const sharedHost = this.sharedEndpoint !== null;
    this.logger.appendLine(
      `Starting ${this.codexExecutable} app-server${sharedHost ? " with a private shared socket" : ""}`
    );
    const args = sharedHost
      ? ["app-server", "--listen", this.sharedEndpoint!.listenUrl]
      : ["app-server"];
    const proc = spawn(this.codexExecutable, args, {
      detached: process.platform !== "win32",
      env: {
        ...process.env,
        [APP_SERVER_OWNER_ENV]: this.processOwnerToken
      },
      stdio: ["pipe", "pipe", "pipe"]
    });
    const lineReader = readline.createInterface({ input: proc.stdout });
    this.proc = proc;
    this.rl = lineReader;

    proc.on("error", (error) => {
      if (this.proc !== proc) {
        return;
      }
      this.rejectAll(new Error(`Failed to start Codex app-server: ${error.message}`));
      this.closeWebSocket();
      this.proc = null;
      if (this.rl === lineReader) {
        lineReader.close();
        this.rl = null;
      }
      this.initializePromise = null;
    });

    proc.on("exit", (code, signal) => {
      if (this.proc !== proc) {
        return;
      }
      const suffix = signal ? `signal ${signal}` : `code ${code ?? "unknown"}`;
      this.logger.appendLine(`Codex app-server exited with ${suffix}`);
      this.rejectAll(new Error(`Codex app-server exited with ${suffix}.`));
      this.closeWebSocket();
      this.proc = null;
      if (this.rl === lineReader) {
        lineReader.close();
        this.rl = null;
      }
      this.initializePromise = null;
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      for (const line of chunk.toString().split(/\r?\n/)) {
        if (line.trim()) {
          if (/Remote app server already online|HTTP error:\s*409 Conflict/i.test(line)) {
            this.remoteControlConflictDetected = true;
          }
          this.logger.appendLine(`[codex] ${this.redactRemoteControlMessage(line)}`);
        }
      }
    });

    lineReader.on("line", (line) => {
      if (!sharedHost && this.proc === proc) {
        this.handleLine(line);
      }
    });

    if (sharedHost) {
      try {
        await this.connectSharedWebSocket(proc);
      } catch (error) {
        if (this.proc === proc) {
          this.proc = null;
          this.initializePromise = null;
          this.rejectAll(error instanceof Error ? error : new Error(String(error)));
        }
        terminateProcessTree(proc);
        throw error;
      }
    }
  }

  private async connectSharedWebSocket(
    proc: ChildProcessWithoutNullStreams
  ): Promise<void> {
    if (!this.sharedEndpoint) {
      return;
    }

    const deadline = Date.now() + this.requestTimeoutMs;
    let lastError: Error | null = null;
    while (Date.now() < deadline) {
      if (proc.exitCode !== null || proc.signalCode !== null || this.proc !== proc) {
        throw new Error("Codex app-server exited before its shared socket was ready.");
      }

      try {
        const websocket = await openWebSocket(
          this.sharedEndpoint.websocketUrl,
          Math.min(500, Math.max(100, deadline - Date.now()))
        );
        if (this.proc !== proc) {
          websocket.terminate();
          throw new Error("Codex app-server was replaced while its shared socket opened.");
        }

        this.websocket = websocket;
        websocket.on("message", (data, isBinary) => {
          if (this.websocket === websocket && !isBinary) {
            this.handleLine(data.toString());
          }
        });
        websocket.on("error", (error) => {
          if (this.websocket === websocket) {
            this.logger.appendLine(
              `Codex shared socket error: ${this.redactRemoteControlMessage(error.message)}`
            );
          }
        });
        websocket.on("close", () => {
          if (this.websocket !== websocket) {
            return;
          }
          this.websocket = null;
          this.rejectAll(new Error("Codex shared app-server connection closed."));
          this.initializePromise = null;
          if (this.proc === proc) {
            this.proc = null;
            terminateProcessTree(proc);
          }
        });
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        await wait(50);
      }
    }

    throw new Error(
      `Timed out opening the Codex shared app-server socket${lastError ? `: ${lastError.message}` : "."}`
    );
  }

  private closeWebSocket(): void {
    const websocket = this.websocket;
    this.websocket = null;
    if (!websocket) {
      return;
    }

    websocket.removeAllListeners();
    try {
      websocket.terminate();
    } catch {
      // The socket is already closed.
    }
  }

  private async stopCurrentProcess(cleanupSharedEndpoint: boolean): Promise<void> {
    const processToStop = this.detachCurrentProcess();
    if (!processToStop) {
      if (cleanupSharedEndpoint) {
        this.sharedEndpoint?.cleanup();
      }
      return;
    }

    const exited = waitForProcessExit(processToStop);
    requestProcessExit(processToStop, this.sharedEndpoint !== null);
    const parentExited = await waitWithTimeout(exited, 1_000);
    terminateProcessTree(processToStop, "SIGTERM");
    if (!parentExited) {
      await waitWithTimeout(exited, 1_000);
    }

    if (cleanupSharedEndpoint) {
      this.sharedEndpoint?.cleanup();
    }
  }

  private detachCurrentProcess(): ChildProcessWithoutNullStreams | null {
    const processToStop = this.proc;
    this.proc = null;
    this.initializePromise = null;
    this.closeWebSocket();
    this.rl?.close();
    this.rl = null;
    this.rejectAll(new Error("Codex app-server process was stopped."));
    return processToStop;
  }

  private request<T>(method: string, params: unknown): Promise<T> {
    if (!this.proc || (this.sharedEndpoint && this.websocket?.readyState !== WebSocket.OPEN)) {
      return Promise.reject(new Error("Codex app-server is not running."));
    }

    const id = this.nextId++;
    const payload = JSON.stringify({ id, method, params });

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timed out waiting for ${method}.`));
      }, this.requestTimeoutMs);

      this.pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timer
      });

      this.writePayload(payload, (error) => {
        if (error) {
          clearTimeout(timer);
          this.pending.delete(id);
          reject(error);
        }
      });
    });
  }

  private notify(method: string, params: unknown): void {
    if (!this.proc) {
      return;
    }
    this.writePayload(JSON.stringify({ method, params }));
  }

  private writePayload(
    payload: string,
    callback?: (error?: Error | null) => void
  ): void {
    if (this.sharedEndpoint) {
      if (this.websocket?.readyState !== WebSocket.OPEN) {
        callback?.(new Error("Codex shared app-server connection is not open."));
        return;
      }
      this.websocket.send(payload, (error) => callback?.(error));
      return;
    }

    if (!this.proc) {
      callback?.(new Error("Codex app-server is not running."));
      return;
    }
    this.proc.stdin.write(`${payload}\n`, callback);
  }

  private handleLine(line: string): void {
    if (!line.trim()) {
      return;
    }

    let message: JsonRpcResponse<unknown> | { id?: unknown; method?: string; params?: unknown };
    try {
      message = JSON.parse(line) as JsonRpcResponse<unknown>;
    } catch (error) {
      this.logger.appendLine(
        `Ignoring non-JSON app-server output: ${this.redactRemoteControlMessage(line)}`
      );
      return;
    }

    const maybeServerMessage = message as { id?: unknown; method?: unknown; params?: unknown };

    if (typeof maybeServerMessage.method === "string") {
      this.handleServerMessage(maybeServerMessage);
      return;
    }

    if (typeof message.id === "number") {
      this.handleResponse(message as JsonRpcResponse<unknown>);
    }
  }

  private handleServerMessage(message: { id?: unknown; method?: unknown; params?: unknown }): void {
    if (message.method === "account/rateLimits/updated") {
      this.logger.appendLine("Received account/rateLimits/updated notification");
      this.eventHandlers.onRateLimitsUpdated?.();
      return;
    }

    if (message.method === "turn/completed") {
      this.eventHandlers.onTurnCompleted?.(parseTurnCompletedEvent(message.params));
      return;
    }

    if (message.method === "remoteControl/status/changed") {
      try {
        const status = this.rememberRemoteControlStatus(
          parseRemoteControlStatus(message.params)
        );
        this.eventHandlers.onRemoteControlStatusChanged?.(status);
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        this.logger.appendLine(`Ignoring invalid remote-control status: ${detail}`);
      }
      return;
    }

    if (typeof message.method === "string" && isNeedsInputMethod(message.method)) {
      const event = parseNeedsUserInputEvent(message.method, message.params);
      this.eventHandlers.onNeedsUserInput?.(event);

      if (message.id !== undefined) {
        this.sendErrorResponse(message.id, -32601, `Codex Companion cannot answer ${message.method}.`);
      }
      return;
    }

    if (message.id !== undefined) {
      this.logger.appendLine(`Rejecting unsupported app-server request: ${message.method ?? "unknown"}`);
      this.sendErrorResponse(message.id, -32601, `Unsupported server request: ${message.method ?? "unknown"}`);
    }
  }

  private handleResponse(response: JsonRpcResponse<unknown>): void {
    const pending = this.pending.get(response.id);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timer);
    this.pending.delete(response.id);

    if (response.error) {
      pending.reject(new Error(this.redactRemoteControlMessage(response.error.message)));
      return;
    }

    pending.resolve(response.result);
  }

  private rejectAll(error: Error): void {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(error);
      this.pending.delete(id);
    }
  }

  private sendErrorResponse(id: unknown, code: number, message: string): void {
    if (!this.proc) {
      return;
    }

    this.writePayload(JSON.stringify({ id, error: { code, message } }));
  }

  private rememberRemoteControlStatus(
    status: RemoteControlStatusSnapshot
  ): RemoteControlStatusSnapshot {
    this.rememberRemoteControlValues(
      status.serverName,
      status.installationId,
      status.environmentId
    );
    return status;
  }

  private rememberRemoteControlValues(...values: Array<string | null>): void {
    for (const value of values) {
      if (value) {
        this.remoteControlSensitiveValues.add(value);
      }
    }
  }

  private redactRemoteControlMessage(message: string): string {
    return redactRemoteControlSecrets(
      message,
      [...this.remoteControlSensitiveValues]
    );
  }
}

function requestProcessExit(
  proc: ChildProcessWithoutNullStreams,
  usesSharedSocket: boolean
): void {
  if (proc.exitCode !== null || proc.signalCode !== null) {
    return;
  }

  if (usesSharedSocket) {
    terminateProcessTree(proc);
    return;
  }

  try {
    proc.stdin.end();
  } catch {
    terminateProcessTree(proc);
  }
}

function openWebSocket(url: string, handshakeTimeout: number): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const websocket = new WebSocket(url, {
      handshakeTimeout,
      perMessageDeflate: false
    });

    const handleOpen = () => {
      websocket.off("error", handleError);
      resolve(websocket);
    };
    const handleError = (error: Error) => {
      websocket.off("open", handleOpen);
      websocket.removeAllListeners();
      websocket.terminate();
      reject(error);
    };
    websocket.once("open", handleOpen);
    websocket.once("error", handleError);
  });
}

function terminateProcessTree(
  proc: ChildProcessWithoutNullStreams,
  signal: NodeJS.Signals = "SIGTERM"
): void {
  try {
    if (process.platform !== "win32" && proc.pid) {
      process.kill(-proc.pid, signal);
    } else {
      if (proc.exitCode === null && proc.signalCode === null) {
        proc.kill(signal);
      }
    }
  } catch {
    try {
      if (proc.exitCode === null && proc.signalCode === null) {
        proc.kill(signal);
      }
    } catch {
      // The process already exited.
    }
  }
}

export function terminateOwnedAppServerProcess(
  identity: CodexAppServerProcessIdentity
): boolean {
  if (process.platform !== "linux" || !Number.isSafeInteger(identity.pid) || identity.pid <= 0) {
    return false;
  }

  try {
    const environment = readFileSync(`/proc/${identity.pid}/environ`);
    const marker = Buffer.from(`${APP_SERVER_OWNER_ENV}=${identity.token}\0`);
    if (!environment.includes(marker)) {
      return false;
    }
    process.kill(-identity.pid, "SIGTERM");
    return true;
  } catch {
    return false;
  }
}

function waitForProcessExit(proc: ChildProcessWithoutNullStreams): Promise<void> {
  if (proc.exitCode !== null || proc.signalCode !== null) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const done = () => {
      proc.off("exit", done);
      proc.off("error", done);
      resolve();
    };
    proc.once("exit", done);
    proc.once("error", done);
  });
}

async function waitWithTimeout(promise: Promise<void>, milliseconds: number): Promise<boolean> {
  let timer: NodeJS.Timeout | null = null;
  const completed = await Promise.race([
    promise.then(() => true),
    new Promise<boolean>((resolve) => {
      timer = setTimeout(() => resolve(false), milliseconds);
      timer.unref();
    })
  ]);
  if (timer) {
    clearTimeout(timer);
  }
  return completed;
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isNeedsInputMethod(method: string): boolean {
  return (
    method === "item/tool/requestUserInput" ||
    method === "item/commandExecution/requestApproval" ||
    method === "item/fileChange/requestApproval" ||
    method === "item/permissions/requestApproval"
  );
}

export function parseTurnCompletedEvent(params: unknown): CodexTurnCompletedEvent {
  const value = asRecord(params);
  const turn = asRecord(value.turn);
  const thread = asRecord(value.thread);

  return {
    threadId: firstString(value.threadId, value.thread_id, thread.id) ?? "unknown",
    turnId: firstString(value.turnId, value.turn_id, turn.id),
    status: readStatus(turn.status ?? value.status),
    durationMs: firstNumber(turn.durationMs, turn.duration_ms, value.durationMs, value.duration_ms),
    completedAt: firstNumber(
      turn.completedAt,
      turn.completed_at,
      turn.completedAtMs,
      turn.completed_at_ms,
      value.completedAt,
      value.completed_at,
      value.completedAtMs,
      value.completed_at_ms
    )
  };
}

export function parseThreadSnapshot(value: unknown): CodexThreadSnapshot | null {
  const thread = asRecord(value);
  const id = firstString(thread.id, thread.threadId, thread.thread_id);
  if (!id) {
    return null;
  }

  const turns = Array.isArray(thread.turns)
    ? thread.turns.map(parseTurnSnapshot).filter((turn): turn is CodexTurnSnapshot => turn !== null)
    : [];
  const gitInfo = asRecord(thread.gitInfo ?? thread.git_info);

  return {
    id,
    turns,
    name: firstString(thread.name, thread.title),
    cwd: firstString(thread.cwd),
    gitBranch: firstString(gitInfo.branch, thread.gitBranch, thread.git_branch),
    source: firstString(thread.source)
  };
}

function parseTurnSnapshot(value: unknown): CodexTurnSnapshot | null {
  const turn = asRecord(value);
  const id = firstString(turn.id, turn.turnId, turn.turn_id);
  if (!id) {
    return null;
  }

  return {
    id,
    status: readStatus(turn.status),
    durationMs: firstNumber(turn.durationMs, turn.duration_ms),
    completedAt: firstNumber(turn.completedAt, turn.completed_at, turn.completedAtMs, turn.completed_at_ms)
  };
}

function parseNeedsUserInputEvent(method: string, params: unknown): CodexNeedsUserInputEvent {
  const value = asRecord(params);
  const firstQuestion = Array.isArray(value.questions) ? asRecord(value.questions[0]) : null;
  const title = method === "item/tool/requestUserInput"
    ? typeof firstQuestion?.header === "string" && firstQuestion.header
      ? firstQuestion.header
      : "Codex needs input"
    : "Codex needs approval";
  const detail = method === "item/tool/requestUserInput"
    ? typeof firstQuestion?.question === "string"
      ? firstQuestion.question
      : null
    : typeof value.reason === "string"
      ? value.reason
      : typeof value.command === "string"
        ? value.command
        : null;

  return {
    method,
    threadId: typeof value.threadId === "string" ? value.threadId : null,
    turnId: typeof value.turnId === "string" ? value.turnId : null,
    title,
    detail
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value) {
      return value;
    }
  }
  return null;
}

function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return null;
}

function readStatus(value: unknown): string | null {
  if (typeof value === "string" && value) {
    return value;
  }

  const status = asRecord(value);
  return firstString(status.type, status.status, status.state);
}
