import { ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import * as readline from "node:readline";
import type {
  ConsumeAccountRateLimitResetCreditResponse,
  GetAccountRateLimitsResponse,
  GetAccountTokenUsageResponse,
  JsonRpcId,
  JsonRpcResponse
} from "./types";

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
}

export interface CodexTurnCompletedEvent {
  threadId: string;
  turnId: string | null;
  status: string | null;
  durationMs: number | null;
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
  private nextId = 1;
  private readonly pending = new Map<JsonRpcId, PendingRequest<unknown>>();
  private initializePromise: Promise<void> | null = null;

  constructor(
    private readonly codexExecutable: string,
    private readonly requestTimeoutMs: number,
    private readonly logger: Logger,
    private readonly eventHandlers: AppServerEventHandlers = {}
  ) {}

  async getRateLimits(): Promise<GetAccountRateLimitsResponse> {
    await this.ensureInitialized();
    return this.request<GetAccountRateLimitsResponse>("account/rateLimits/read", null);
  }

  async getTokenUsage(): Promise<GetAccountTokenUsageResponse> {
    await this.ensureInitialized();
    return this.request<GetAccountTokenUsageResponse>("account/usage/read", null);
  }

  async consumeRateLimitResetCredit(idempotencyKey: string): Promise<ConsumeAccountRateLimitResetCreditResponse> {
    await this.ensureInitialized();
    return this.request<ConsumeAccountRateLimitResetCreditResponse>("account/rateLimitResetCredit/consume", {
      idempotencyKey
    });
  }

  async restart(): Promise<void> {
    this.dispose();
    await this.ensureInitialized();
  }

  dispose(): void {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(new Error(`Codex app-server request ${id} was cancelled.`));
    }
    this.pending.clear();
    this.rl?.close();
    this.rl = null;
    this.proc?.kill();
    this.proc = null;
    this.initializePromise = null;
  }

  private ensureInitialized(): Promise<void> {
    if (!this.initializePromise) {
      this.initializePromise = this.initialize();
    }
    return this.initializePromise;
  }

  private async initialize(): Promise<void> {
    this.startProcess();

    await this.request("initialize", {
      clientInfo: {
        name: "codex_usage_status_vscode",
        title: "Codex Usage Status",
        version: "0.1.1"
      },
      capabilities: {
        experimentalApi: true
      }
    });

    this.notify("initialized", {});
  }

  private startProcess(): void {
    if (this.proc) {
      return;
    }

    this.logger.appendLine(`Starting ${this.codexExecutable} app-server`);
    this.proc = spawn(this.codexExecutable, ["app-server"], {
      stdio: ["pipe", "pipe", "pipe"]
    });

    this.proc.on("error", (error) => {
      this.rejectAll(new Error(`Failed to start Codex app-server: ${error.message}`));
      this.initializePromise = null;
    });

    this.proc.on("exit", (code, signal) => {
      const suffix = signal ? `signal ${signal}` : `code ${code ?? "unknown"}`;
      this.logger.appendLine(`Codex app-server exited with ${suffix}`);
      this.rejectAll(new Error(`Codex app-server exited with ${suffix}.`));
      this.proc = null;
      this.initializePromise = null;
    });

    this.proc.stderr.on("data", (chunk: Buffer) => {
      for (const line of chunk.toString().split(/\r?\n/)) {
        if (line.trim()) {
          this.logger.appendLine(`[codex] ${line}`);
        }
      }
    });

    this.rl = readline.createInterface({ input: this.proc.stdout });
    this.rl.on("line", (line) => this.handleLine(line));
  }

  private request<T>(method: string, params: unknown): Promise<T> {
    if (!this.proc) {
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

      this.proc?.stdin.write(`${payload}\n`, (error) => {
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
    this.proc.stdin.write(`${JSON.stringify({ method, params })}\n`);
  }

  private handleLine(line: string): void {
    if (!line.trim()) {
      return;
    }

    let message: JsonRpcResponse<unknown> | { id?: unknown; method?: string; params?: unknown };
    try {
      message = JSON.parse(line) as JsonRpcResponse<unknown>;
    } catch (error) {
      this.logger.appendLine(`Ignoring non-JSON app-server output: ${line}`);
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

    if (typeof message.method === "string" && isNeedsInputMethod(message.method)) {
      const event = parseNeedsUserInputEvent(message.method, message.params);
      this.eventHandlers.onNeedsUserInput?.(event);

      if (message.id !== undefined) {
        this.sendErrorResponse(message.id, -32601, `Codex Usage Status cannot answer ${message.method}.`);
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
      pending.reject(new Error(response.error.message));
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

    this.proc.stdin.write(`${JSON.stringify({ id, error: { code, message } })}\n`);
  }
}

function isNeedsInputMethod(method: string): boolean {
  return (
    method === "item/tool/requestUserInput" ||
    method === "item/commandExecution/requestApproval" ||
    method === "item/fileChange/requestApproval" ||
    method === "item/permissions/requestApproval"
  );
}

function parseTurnCompletedEvent(params: unknown): CodexTurnCompletedEvent {
  const value = asRecord(params);
  const turn = asRecord(value.turn);

  return {
    threadId: typeof value.threadId === "string" ? value.threadId : "unknown",
    turnId: typeof turn.id === "string" ? turn.id : null,
    status: typeof turn.status === "string" ? turn.status : null,
    durationMs: typeof turn.durationMs === "number" ? turn.durationMs : null
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
