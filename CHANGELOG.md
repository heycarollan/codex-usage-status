# Changelog

## 1.2.0

- Add an opt-in shared live-stream mode on Linux and macOS that starts the supported Codex app-server on a private Unix socket and connects Codex Companion over WebSocket.
- Add **Open Shared Codex Terminal**, which runs the official `codex --remote unix://...` client against Companion's app-server so terminal chats and ChatGPT Remote receive one process-local event stream.
- Keep the default stdio host unchanged and state explicitly that the official VS Code Codex panel still uses a separate app-server and cannot be bridged through a supported API.
- Secure each shared endpoint inside a random per-process directory with owner-only permissions, disable unsupported WebSocket compression, terminate the exact child process group, and remove the socket directory during shutdown.
- Add regression coverage for shared WebSocket initialization, restart, ephemeral Remote disable, single-process lifecycle, and endpoint cleanup.
- Rewrite Remote setup and settings in plain language, with a short three-step guide and clearer Pair, Live Updates, Unpair, and phone-recovery actions.

## 1.1.1

- Keep Remote Control runtime-only inside Codex Companion and coordinate a single relay-owning VS Code extension host, preventing older or parallel Companion app-server processes from reconnecting through a persisted Codex preference.
- Shut Remote Control down ephemerally before app-server restart or extension deactivation, wait for the old child to exit, and prevent late exit events from invalidating or orphaning the replacement process.
- Refresh every page of paired controller devices before **Remove Remote Connection**, report incomplete cleanup honestly, and keep removal limited to the supported disable and device-revocation APIs.
- Explain that the supported Codex app-server API cannot list or delete saved Remote environments or force-refresh the ChatGPT phone app's active-chat list, with supported recovery steps for stale phone state.
- Document that live thread activity is app-server-process-local: computer chats running in another Codex/ChatGPT process can lag on the phone until reopened, and no supported cross-process status or event API exists.
- Verify that Codex CLI 0.144.1 and the official VS Code extension's 0.146.0-alpha.9.2 bundle expose the same Remote lifecycle shape and reuse the existing environment across ephemeral disable, re-enable, and process restart.

## 1.1.0

- Rename the Marketplace display name to **Codex Companion: Remote Control, Usage Status & Resets** while preserving the existing `synapticraft.codex-usage-status` identifier and upgrade path.
- Add search metadata for Codex Remote Control, ChatGPT Remote, Linux, headless, mobile, usage, notifications, and reset credits.
- Split documentation by audience: GitHub leads with an official standalone Linux Remote setup that does not require VS Code, while the packaged Marketplace README focuses on the extension and links to the Linux route.
- Add opt-in ChatGPT Remote setup backed by Codex's official internet relay and experimental `remoteControl/*` app-server API.
- Create short-lived manual pairing codes from the unified settings editor without logging or persisting the pairing artifacts.
- Show relay connection state and paired controller devices, with explicit per-device revocation.
- Reconnect remote control only when `codexUsage.remoteControlEnabled` is enabled; keep it disabled by default and expose no local network listener.
- Add the `Codex Companion: Set Up Remote Control` command and document the always-awake host requirement and rollout constraints.
- Add a persistent Remote status-bar button beside usage that opens and focuses the Remote Control section, plus one-time first-install guidance and highlighting.
- Add a guarded **Remove Remote Connection** action that disables the relay and revokes every currently listed paired device while keeping setup available for later.
- Add a separate GitHub release badge so repository and Marketplace versions remain visually distinguishable.

## 1.0.1

- Add an executable source setting that can automatically use the Codex CLI bundled with the official OpenAI Codex extension.

## 1.0.0

- Restore **Go to Chat** with the local conversation-editor resource registered by the current OpenAI extension, replacing the previously unsuccessful external URI route.
- Add completion-action settings for exact local chat (experimental), the supported general Codex sidebar, or no action.
- Make VS Code notifications the default and honor the configured VS Code, native Linux, or combined notification mode without duplicate action toasts.
- Replace the status-bar Quick Pick with a unified settings editor containing every extension preference plus live usage, account, token, bucket, and reset-credit details.
- Add Refresh, Restart Server, Open Logs, and guarded Use Reset Credit buttons to the settings editor with concise reset-credit descriptions.
- Remove the separate pulse button and open the settings editor from the usage display or tooltip action.
- Keep refresh, reset-credit use, app-server restart, settings, and logs available as explicit Command Palette commands.

## 0.1.7

- Explicitly consume the available reset credit with the nearest expiration when Codex provides per-credit IDs.
- Keep automatic server-side credit selection as a compatibility fallback for older Codex versions that report only an available count.
- Show the selected credit's expiration in the reset confirmation prompt.

## 0.1.6

- Show full reset-credit details in the hover tooltip, including status, scope, grant time, expiration time, and description.
- Display a missing 5-hour usage window as `N/A` instead of duplicating the 7-day value.
- Match rate-limit windows by their reported duration so future 5-hour windows appear automatically when Codex provides them.

## 0.1.5

- Add recent-thread polling so completed VS Code Codex chats can notify even when live app-server completion events are not delivered to the status-bar connection.
- Avoid suppressing future completion notifications when a completion event is missing a turn id.
- Show the VS Code completion toast as well when native notifications are enabled so the Show Usage action is visible.

## 0.1.4

- Replace the retired Shields.io Marketplace badge with a working Marketplace version badge.

## 0.1.3

- Clarify that reset credits can be viewed and used directly from VS Code.
- Update Marketplace description keywords around reset credits and quota monitoring.

## 0.1.2

- Prepare Marketplace packaging with Synapticraft publisher metadata and icon.
- Add usage warning notifications when 5-hour or 7-day usage crosses the configured warning threshold.
- Make native Linux informational notifications visible by using normal urgency.
- Remove internal publishing notes from the public README.

## 0.1.0

- Add Codex 5-hour and 7-day status bar usage.
- Add readable Markdown hover tooltip.
- Add Quick Pick details view.
- Add 10-second default refresh.
- Add reset-credit command and Quick Pick action.
- Add app-server event notifications for visible completion and input/approval events.
- Add commands for refresh, details, app-server restart, and settings.
- Add app-server JSON-RPC client and usage normalization.
- Add tests for formatting and bucket normalization.
