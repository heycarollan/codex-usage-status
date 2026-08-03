<p align="center">
  <img src="https://raw.githubusercontent.com/heycarollan/codex-usage-status/main/assets/synapticraft-icon.png" alt="Codex Companion by Synapticraft" width="128">
</p>

<h1 align="center">Codex Companion: ChatGPT Remote & Usage</h1>

<p align="center"><strong>ChatGPT Remote and Codex usage status for VS Code.</strong></p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=synapticraft.codex-usage-status"><img src="https://badgen.net/badge/Marketplace/V1/00695c" alt="Marketplace V1"></a>
  <a href="https://github.com/heycarollan/codex-usage-status/releases/latest"><img src="https://badgen.net/badge/GitHub/V1/00695c" alt="GitHub V1"></a>
  <img src="https://badgen.net/badge/Package/V1/00695c" alt="Package V1">
</p>

Codex Companion is a VS Code extension for Codex usage status and optional ChatGPT Remote access. Remote access uses a Companion-managed Codex host and includes connection state, paired-device management, and access removal. The extension also provides completion alerts, chat navigation, and reset-credit details.

## Where to start a Remote chat

To control a Codex chat from the phone:

1. Open the project workspace in the VS Code window that will remain online.
2. In Codex Companion, enable Remote access, pair the phone, and wait for **Connected**.
3. On the phone, open ChatGPT, select **Remote**, choose the Companion host, and start the chat from that Remote screen.
4. Continue using that same Remote chat for prompts, questions, outputs, diffs, and approvals.

The chat must belong to the Companion Remote host. A chat already running in the official VS Code Codex panel, a normal ChatGPT chat, another terminal, or another Codex process cannot be attached to Companion or taken over from the phone. To make existing work remote-controllable, start a new chat from **Remote** and provide the relevant context there.

Keep the selected VS Code window and computer running, awake, and online. Companion coordinates one relay-owning extension host across VS Code windows; do not also start a separate standalone `codex remote-control` host for the same Companion connection.

> **Standalone Linux Remote host:** This project documents the official standalone Codex Remote host. See the [Linux setup on GitHub](https://github.com/heycarollan/codex-usage-status#linux-remote-control-without-vs-code). It does not require the VS Code extension or a separate desktop controller.

> **Desktop host with Linux over SSH:** The ChatGPT desktop app on macOS or Windows can host a Remote session connected to a Linux project over SSH. Chats run by that desktop host can provide live steering, streaming output, questions, and approvals from Remote. It cannot take over a chat already running in the VS Code Codex panel. The [GitHub guide](https://github.com/heycarollan/codex-usage-status#more-complete-remote-continuity-desktop-host--linux-over-ssh) explains the boundary and optional Tailscale transport.

## Features

- Display Codex 5-hour and 7-day usage in the status bar, using `N/A` when Codex does not provide a window.
- Pair ChatGPT Remote, see connection state, manage paired devices, and turn Remote access off from VS Code.
- Show account, token, model-bucket, reset-credit, and expiration details in a unified settings editor.
- Notify for usage warnings, completed Codex turns, and input or approval requests.
- Open the exact completed local Codex chat, the general Codex sidebar, or no chat action.
- Use the available reset credit nearest expiration after a modal confirmation.
- On Linux or macOS, optionally open the official Codex terminal against Companion's private local app-server socket. It does not mirror the phone live.
- Open Remote setup from a status-bar button beside usage, or hide that button with a simple settings checkbox.

## Set up ChatGPT Remote

Remote access is disabled by default.

When ChatGPT Remote is available for the account, use the following flow:

1. Select the **Remote** button beside Codex usage in the status bar. On first install, Codex Companion highlights it and shows a one-time setup message.
2. Select **Enable and create pairing code**.
3. Open **Remote** in the ChatGPT mobile app and enter the displayed code.
4. Keep the host computer awake, online, and running VS Code.

> **What the phone controls:** This extension creates a dedicated Companion Codex host. Start a new chat from **Remote** on the phone, then use that same Remote chat for follow-ups, questions, outputs, diffs, and approvals. Companion cannot take over or live-mirror a chat that is already running in the official VS Code Codex panel, another terminal, or another Codex process. A completed chat may appear in history, but that does not make its original desktop session live-controllable.

Once paired, ChatGPT connects to Codex Companion's own app-server host over OpenAI's internet relay. Chats started or resumed on that host support prompts, steering, questions, outputs, diffs, and action approvals from outside the local network.

The extension exposes no inbound network listener. Default mode uses stdio; optional shared-host mode creates an owner-readable Unix socket inside a random owner-only directory and opens no TCP port. Pairing artifacts remain in memory, expire automatically, and never enter extension logs. One Companion extension host owns the relay at a time so parallel VS Code windows do not start competing Remote connections. Remote availability can depend on the installed Codex version, ChatGPT rollout, account/workspace eligibility, and managed policy. Companion uses the public but experimental `remoteControl/*` methods in Codex's app-server schema; it does not call a private Remote backend. OpenAI's general Remote guide does not yet document IDE-based setup.

Use **Remove Remote Connection** at the bottom of the section to refresh and revoke the supported paired-device list, then disable the relay. If you do not want the Remote status-bar button, turn off **Show Remote button in the status bar** in settings; this does not disconnect or unpair anything.

### Optional Remote Codex Terminal

On Linux or macOS, enable **Remote Codex Terminal**, then select **Open Remote Codex Terminal**. The official `codex --remote` terminal connects to Companion's private local app-server socket.

The terminal is a separate client and does not mirror the phone or official VS Code Codex panel live. In real-device testing, terminal work appeared on the phone only after completion, and a phone reply did not appear in the open terminal. Close and reopen the phone chat to refresh it. Restarting Companion or changing the terminal setting closes the current terminal; open a new one afterward.

### If the phone chat list or activity is stale

Codex Companion does not render or store the ChatGPT phone interface. The supported Codex app-server methods can read relay status, pair and revoke controllers, and disable the local connection. They cannot list or delete saved Remote environments or force-refresh ChatGPT mobile's active-chat list.

Codex live events are scoped to client connections. One app-server process does not make the Remote Codex Terminal and phone one synchronized interface. Terminal output may reach the phone only after completion, phone replies may not appear in the terminal, and Thinking or Working state may lag until the phone chat is closed and reopened. Chats in a separate Codex, ChatGPT, or IDE app-server have the same limitation. No supported API lets Companion mirror those live events between clients or processes.

Restart and re-pair steps can recover the relay but cannot merge separate client or app-server activity streams. If the open chat is current while its list row lacks an activity icon, that row is controlled by the ChatGPT mobile app. Old entries that survive re-pairing are OpenAI Remote/ChatGPT synchronization state and cannot be removed by this extension through a supported API.

## Commands

- `Codex Companion: Refresh Usage`
- `Codex Companion: Restart Codex Connection`
- `Codex Companion: Use Reset Credit`
- `Codex Companion: Open Settings`
- `Codex Companion: Open Logs`
- `Codex Companion: Pair Phone`
- `Codex Companion: Open Remote Codex Terminal`

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `codexUsage.refreshIntervalSeconds` | `10` | How often to refresh usage. |
| `codexUsage.codexExecutable` | `codex` | Path or command name for the Codex CLI. |
| `codexUsage.showExtraBuckets` | `true` | Show model-specific usage buckets. |
| `codexUsage.statusFormat` | `compact` | Show used or remaining percentage. |
| `codexUsage.warnAtPercent` | `90` | Highlight and notify at this usage percentage. |
| `codexUsage.requestTimeoutMs` | `12000` | App-server request timeout. |
| `codexUsage.notifyUsageWarnings` | `true` | Notify when reported usage crosses the threshold. |
| `codexUsage.notifyTurnComplete` | `true` | Notify for visible turn completions. |
| `codexUsage.notifyNeedsInput` | `true` | Notify for visible input and approval requests. |
| `codexUsage.notificationMode` | `vscode` | Use VS Code, native Linux, or both notification paths. |
| `codexUsage.completionChatAction` | `exact` | Open the exact chat, sidebar, or no action. |
| `codexUsage.remoteControlEnabled` | `false` | Let one Companion window reconnect to OpenAI's Remote Control relay while VS Code runs. |
| `codexUsage.showRemoteStatusBarButton` | `true` | Show or hide the Remote status-bar button without changing the connection. |
| `codexUsage.sharedRemoteHostEnabled` | `false` | On Linux or macOS, enable the optional Remote Codex Terminal. It does not mirror the phone live. |

## Requirements and privacy

- VS Code, Cursor, Windsurf, or a compatible editor.
- A working Codex CLI and login.
- A Codex version exposing the experimental Remote Control methods for remote setup.

The extension runs locally and does not store Codex credentials. Usage data stays local. When remote access is explicitly enabled, Codex—not this extension—connects to OpenAI's relay under the account's existing authentication, workspace policy, sandbox, and approval settings.

Source, Linux Remote setup, security policy, and releases are available on [GitHub](https://github.com/heycarollan/codex-usage-status).
