# Remote Control Design

## Outcome

Codex Companion provides an opt-in setup and device-management surface for Codex's official Remote Control capability. Codex itself connects outbound to OpenAI's internet relay. A paired ChatGPT mobile client supplies the remote chat, output, diff, input, and approval interface.

The extension does not implement a second relay, browser client, shell proxy, or generic JSON-RPC bridge. Its optional shared-host mode connects only the official Codex terminal client to the same supported app-server process.

For Linux users who do not run VS Code, the GitHub documentation routes directly to Codex's official standalone installer and managed `codex remote-control` daemon. This is a separate distribution path for the same upstream Remote Control system, not a second Synapticraft desktop application or relay.

## User flow

1. Select the persistent **Remote** status-bar button beside usage. First install highlights the button and offers a one-click setup message.
2. Select **Enable and create pairing code**.
3. The extension acquires the per-user Companion host lease, clears the old durable Codex preference from 1.1.0 when present, enables Remote for this app-server process only, and waits for the outbound relay connection.
4. The extension requests a short-lived manual pairing code and displays it locally.
5. Copy the code into **Remote** in the ChatGPT mobile app.
6. The extension polls the opaque pairing artifact until Codex reports it claimed, then refreshes the paired-device list.
7. Revoke individual devices or disable the host connection from the same settings page.
8. Optionally enable the shared host on Linux or macOS and open the **Shared Codex Terminal** so terminal chats and Remote use one live app-server runtime.
9. Use **Remove Remote Connection** for a confirmed cleanup that refreshes every page of controller devices, revokes the returned grants, and disables the local relay while preserving the setup entry point.

The host computer must remain awake and online with VS Code and this extension running. Only one Companion extension host per OS user owns Remote at a time. A second VS Code window stays disconnected and retries lease acquisition during normal Remote refreshes.

## Architecture

```text
ChatGPT mobile app
        |
        | authenticated OpenAI Remote Control connection
        v
OpenAI internet relay
        ^
        | outbound connection owned by Codex
        |
codex app-server <---- stdio or private Unix WebSocket ----> Codex Companion
        |
        +---- official `codex --remote` terminal (optional shared host)
        +---- local Codex threads, tools, approvals, and workspace policy
```

The extension calls only these allowlisted experimental app-server methods:

- `remoteControl/status/read`
- `remoteControl/enable`
- `remoteControl/disable`
- `remoteControl/pairing/start`
- `remoteControl/pairing/status`
- `remoteControl/client/list`
- `remoteControl/client/revoke`

It listens only for `remoteControl/status/changed`. It does not accept remote requests itself or forward caller-selected app-server method names. In shared-host mode, the official CLI connects directly to Codex's documented Unix-socket app-server transport.

The generated experimental schema exposes no Remote environment list, delete, unregister, session cleanup, or phone refresh method. `remoteControl/disable` stops this process's relay connection but intentionally retains Codex's saved enrollment and device grants. `remoteControl/client/revoke` removes a controller grant, not the saved environment or ChatGPT chat metadata.

## Lifecycle ownership

- Codex Companion keeps `codexUsage.remoteControlEnabled` as its durable opt-in and invokes `remoteControl/enable` with `ephemeral: true`. It invokes a durable disable once per app-server client to migrate and clear the 1.1.0 preference that otherwise makes every same-named app-server auto-connect.
- A local per-user lease contains only an extension-host PID and random token. It prevents parallel VS Code windows and isolated test profiles from opening competing relay connections. A dead owner's lease is reclaimed.
- Restart and deactivation request `remoteControl/disable` with `ephemeral: true`. Stdio mode closes app-server stdin; shared mode closes the WebSocket and signals the exact detached child process group. Both paths wait for exit and use a bounded exact-process fallback.
- Child exit/error handlers are bound to the process that emitted them. A late exit from an old process cannot clear the reference, initialization promise, or pending requests for its replacement.
- Codex persists and reuses the same enrollment for the Companion client name. Live comparison on Codex CLI 0.144.1 and the official VS Code extension's 0.146.0-alpha.9.2 bundle showed the same environment before and after ephemeral disable/re-enable and process restart; neither schema adds a cleanup API.
- Shared mode creates a random runtime directory with mode `0700`; Codex creates the Unix socket with mode `0600`. WebSocket compression is disabled to match the supported Unix listener. Restart reuses the endpoint only after the old child exits, and final shutdown removes the socket and empty directory.

## Live activity limitation

Codex app-server's `ThreadWatchManager` and loaded-thread runtime are process-scoped. `thread/status/changed`, streamed turn items, approval state, and Thinking or Working status originate only from the app-server process executing that turn. A second app-server can discover persisted threads through `thread/list`, but it reports threads owned by another live process as `notLoaded` and receives none of that process's turn notifications.

This matters because Codex Companion starts its own supported `codex app-server`, while the official Codex or ChatGPT computer interface normally runs another app-server. Chats started or continued through Companion Remote can stream normally. Shared-host mode also launches the documented `codex --remote unix://...` terminal against Companion's process, so chats run in that terminal and on the phone use the same loaded-thread runtime. Computer chats in the separate official VS Code panel can still appear only from shared saved history, and their phone transcript and list activity may lag until ChatGPT requests a fresh read, such as after closing and reopening the chat. The supported protocol exposes no cross-process attach, event subscription, invalidation, or status-set method. Loading or resuming an already-running thread in the Companion process would create competing runtimes and is not a safe workaround.

The extension must not claim to fix this boundary. Relay restart and re-pair actions address connectivity only. A missing list-row activity icon when the open chat is otherwise streaming is additionally owned by ChatGPT mobile's rendering and synchronization.

## Trust boundaries

- **Local extension host:** trusted to start Codex, render setup state, invoke the fixed remote-control API, and pass its private socket path to the official local Codex CLI on explicit request.
- **Codex app-server:** owns ChatGPT authentication, the saved relay enrollment, Remote transport, local thread execution, policy enforcement, and approval routing.
- **OpenAI relay and ChatGPT client:** own authenticated Remote service state, synchronization, and the phone interface. The extension does not receive or store their account tokens and cannot refresh or delete the phone's active-chat list.
- **Settings webview:** treated as untrusted input. Commands are matched against a fixed switch, client revocation IDs must already exist in the current device list, and all rendered values are escaped.
- **Pairing artifacts:** bearer-like, short-lived setup values. They remain in process memory, are copied only on explicit request, expire automatically, and never enter logs or configuration.

## Security properties

- Disabled by default through `codexUsage.remoteControlEnabled`.
- No inbound TCP listener, shell proxy, or arbitrary VS Code command execution. Shared mode exposes one temporary owner-readable Unix app-server socket to local processes; it is disabled by default, uses no network port, and is removed at shutdown.
- No prompt, command, diff, or approval payload is proxied or logged by this extension. Those controls remain inside the official ChatGPT Remote client and Codex approval system.
- Device revocation requires a local modal confirmation and an ID from the current Codex-provided device list.
- Full connection removal requires a local modal confirmation, refreshes all cursor pages, revokes only IDs from that same allowlisted list, disables the relay, and reports a failed refresh or partial revocation honestly.
- Disabling the relay does not silently claim to revoke device grants; the UI states that grants persist until explicitly revoked.
- Audit lines record enable, disable, code creation time, successful pairing, and revocation without recording codes, environment IDs, client IDs, prompts, or command contents.
- Managed workspace policy can reject Remote Control; the extension reports the app-server error and does not bypass it.

## Settings and UI

- `codexUsage.remoteControlEnabled` defaults to `false`.
- `codexUsage.sharedRemoteHostEnabled` defaults to `false` and is available only on Linux and macOS.
- The unified settings editor shows relay state, the local server name, the short-lived manual code, paired devices, explicit refresh/disable/revoke actions, and accurate stale-phone-list recovery guidance.
- The settings editor and **Codex Companion: Open Shared Codex Terminal** command state that only terminal chats share Remote's live process; the official VS Code Codex panel remains separate.
- The persistent **Remote** status-bar button reflects Off, Connecting, On, or Error and opens the unified settings editor scrolled directly to Remote Control.
- **Codex Companion: Set Up Remote Control** remains available as an alternate entry point and uses the same focused settings section.
- A one-time first-install message explains the new button. While the message is open, the button receives the warning highlight; dismissing it does not hide the permanent button.
- Pairing artifacts are not persisted across extension-host restarts.

## Product and documentation surfaces

- The stable Marketplace identifier remains `synapticraft.codex-usage-status`, preserving installs, ratings, and update continuity.
- The visible Marketplace name is **Codex Companion: Remote Control, Usage Status & Resets** so the title contains the broader brand and concrete high-intent feature terms without a vague "and more" suffix.
- Manifest description and keywords cover Codex, remote control, ChatGPT Remote, Linux, headless, mobile, usage, completions, and reset credits. VS Code documents `displayName`, `description`, and keywords as search inputs.
- The repository README serves both audiences and leads with a choice between Linux Remote and the extension.
- `docs/marketplace-readme.md` is packaged as the Marketplace README. It stays extension-focused and links web visitors to the no-VS-Code Linux route.

## Verification

- Unit tests validate status, pairing, expiration, claim, device-list response parsing, single-owner lease behavior, stale-lease recovery, race-free app-server restart/shutdown, shared WebSocket initialization, and private endpoint cleanup.
- Webview tests verify HTML escaping, fixed command names, device revocation controls, and that the opaque pairing artifact is not rendered.
- The normal test suite compiles all TypeScript and runs every unit test.
- A bounded live probe against the configured Codex binary must verify enable, status, environment reuse, device-list count, restart, and disable without printing identifiers or pairing values.
- The settings UI receives desktop-width visual inspection with fake data before review.
- VSIX contents must be inspected to ensure no credentials or temporary live-probe artifacts are packaged.

## Release sequence

1. Review the 1.1.1 lifecycle corrections and the opt-in 1.2.0 shared-host experiment locally.
2. Package and install the VSIX in an isolated VS Code profile.
3. Verify a chat run in **Shared Codex Terminal** from the paired phone, including live transcript and Thinking or Working state.
4. Confirm separately whether ChatGPT mobile's list-row activity icon updates; record it as upstream UI state if the open chat streams while the row remains stale.
5. Revoke and disable the test connection when validation is complete.
6. Do not push, merge, release, or publish until explicit maintainer approval.

## Upstream dependency

The `remoteControl/*` methods and `codex remote-control` command are currently marked experimental by Codex. The command reference documents `start`, `stop`, and `pair`, while the general Remote setup guide still says normal setup starts in the desktop app and is unavailable from the CLI or IDE extension. Availability can depend on Codex version, ChatGPT Remote rollout, account/workspace eligibility, and managed `allow_remote_control` policy. The extension fails closed when the methods are unavailable, and release remains gated on real-device mobile pairing proof.
