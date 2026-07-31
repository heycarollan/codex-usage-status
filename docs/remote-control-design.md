# Remote Control Design

## Outcome

Codex Companion provides an opt-in setup and device-management surface for Codex's official Remote Control capability. Codex itself connects outbound to OpenAI's internet relay. A paired ChatGPT mobile client supplies the remote chat, output, diff, input, and approval interface.

The extension does not implement a second relay, browser client, shell proxy, or generic JSON-RPC bridge.

For Linux users who do not run VS Code, the GitHub documentation routes directly to Codex's official standalone installer and managed `codex remote-control` daemon. This is a separate distribution path for the same upstream Remote Control system, not a second Synapticraft desktop application or relay.

## User flow

1. Select the persistent **Remote** status-bar button beside usage. First install highlights the button and offers a one-click setup message.
2. Select **Enable and create pairing code**.
3. The extension enables Codex Remote Control and waits for the outbound relay connection.
4. The extension requests a short-lived manual pairing code and displays it locally.
5. Copy the code into **Remote** in the ChatGPT mobile app.
6. The extension polls the opaque pairing artifact until Codex reports it claimed, then refreshes the paired-device list.
7. Revoke individual devices or disable the host connection from the same settings page.
8. Use **Remove Remote Connection** for a confirmed cleanup that revokes every currently listed paired device and disables the host while preserving the setup entry point.

The host computer must remain awake and online with VS Code and this extension running.

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
codex app-server <---- stdio JSON-RPC ----> Codex Companion
        |
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

It listens only for `remoteControl/status/changed`. It does not accept remote requests itself or forward caller-selected app-server method names.

## Trust boundaries

- **Local extension host:** trusted to start Codex, render setup state, and invoke the fixed remote-control API.
- **Codex app-server:** owns ChatGPT authentication, relay enrollment, remote sessions, policy enforcement, and approval routing.
- **OpenAI relay and ChatGPT client:** part of the official authenticated Remote Control system. The extension does not receive or store their account tokens.
- **Settings webview:** treated as untrusted input. Commands are matched against a fixed switch, client revocation IDs must already exist in the current device list, and all rendered values are escaped.
- **Pairing artifacts:** bearer-like, short-lived setup values. They remain in process memory, are copied only on explicit request, expire automatically, and never enter logs or configuration.

## Security properties

- Disabled by default through `codexUsage.remoteControlEnabled`.
- No inbound TCP listener, raw app-server exposure, shell endpoint, filesystem endpoint, or arbitrary VS Code command execution.
- No prompt, command, diff, or approval payload is proxied or logged by this extension. Those controls remain inside the official ChatGPT Remote client and Codex approval system.
- Device revocation requires a local modal confirmation and an ID from the current Codex-provided device list.
- Full connection removal requires a local modal confirmation, revokes only IDs from that same allowlisted list, disables the relay, and reports any partial revocation failure honestly.
- Disabling the relay does not silently claim to revoke device grants; the UI states that grants persist until explicitly revoked.
- Audit lines record enable, disable, code creation time, successful pairing, and revocation without recording codes, environment IDs, client IDs, prompts, or command contents.
- Managed workspace policy can reject Remote Control; the extension reports the app-server error and does not bypass it.

## Settings and UI

- `codexUsage.remoteControlEnabled` defaults to `false`.
- The unified settings editor shows relay state, the local server name, the short-lived manual code, paired devices, and explicit refresh/disable/revoke actions.
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

- Unit tests validate status, pairing, expiration, claim, and device-list response parsing.
- Webview tests verify HTML escaping, fixed command names, device revocation controls, and that the opaque pairing artifact is not rendered.
- The normal test suite compiles all TypeScript and runs every unit test.
- A bounded live probe against the configured Codex binary must verify enable, connected status, pairing creation, future expiration, pairing-status read, device-list read, and disable without printing identifiers or pairing values.
- The settings UI receives desktop-width visual inspection with fake data before review.
- VSIX contents must be inspected to ensure no credentials or temporary live-probe artifacts are packaged.

## Release sequence

1. Publish and verify the already-reviewed 1.0.0 Marketplace artifact.
2. Let contributor PR #1 finish as the 1.0.1 maintenance release.
3. Rebase this 1.1.0 branch onto the resulting `main` and resolve version/changelog overlap.
4. Review the experimental Codex API dependency, UI, tests, live-probe evidence, and security boundaries.
5. Test pairing with a real ChatGPT mobile device and revoke it again.
6. Publish 1.1.0 only after explicit maintainer approval.

## Upstream dependency

The `remoteControl/*` methods and `codex remote-control` command are currently marked experimental by Codex. The command reference documents `start`, `stop`, and `pair`, while the general Remote setup guide still says normal setup starts in the desktop app and is unavailable from the CLI or IDE extension. Availability can depend on Codex version, ChatGPT Remote rollout, account/workspace eligibility, and managed `allow_remote_control` policy. The extension fails closed when the methods are unavailable, and release remains gated on real-device mobile pairing proof.
