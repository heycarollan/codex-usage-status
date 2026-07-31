# Codex Companion: Remote Control, Usage Status & Resets

[![VS Code Marketplace](https://badgen.net/vs-marketplace/v/synapticraft.codex-usage-status)](https://marketplace.visualstudio.com/items?itemName=synapticraft.codex-usage-status)
[![GitHub release](https://badgen.net/github/release/heycarollan/codex-usage-status)](https://github.com/heycarollan/codex-usage-status/releases/latest)

Set up ChatGPT Remote in about a minute, monitor Codex usage, receive completion alerts, return to exact chats, and manage reset credits from one VS Code settings page.

> **Linux without VS Code?** This project also documents the official standalone Codex Remote host. Use the [one-block Linux setup on GitHub](https://github.com/heycarollan/codex-usage-status#linux-remote-control-without-vs-code)—no VS Code extension or separate desktop controller is required.

## Features

- Display Codex 5-hour and 7-day usage in the status bar, using `N/A` when Codex does not provide a window.
- Show account, token, model-bucket, reset-credit, and expiration details in a unified settings editor.
- Notify for usage warnings, completed Codex turns, and input or approval requests.
- Open the exact completed local Codex chat, the general Codex sidebar, or no chat action.
- Use the available reset credit nearest expiration after a modal confirmation.
- Enable Codex's official Remote Control relay, create and copy a short-lived manual pairing code, inspect connection state, and revoke paired ChatGPT devices.
- On Linux or macOS, optionally open the official Codex terminal against Companion's private local app-server socket. It does not mirror the phone live.
- Open Remote setup directly from a persistent status-bar button beside usage, with one-time first-install guidance and no Command Palette step.

## Set up ChatGPT Remote

Remote access is disabled by default.

When ChatGPT Remote is available for the account, the guided flow is designed to take about a minute:

1. Select the **Remote** button beside Codex usage in the status bar. On first install, Codex Companion highlights it and shows a one-time setup message.
2. Select **Enable and create pairing code**.
3. Open **Remote** in the ChatGPT mobile app and enter the displayed code.
4. Keep the host computer awake, online, and running VS Code.

Once paired, ChatGPT connects to Codex Companion's app-server over OpenAI's internet relay. Chats handled by that Remote host support prompts, steering, questions, outputs, diffs, and action approvals from outside the local network.

The extension exposes no inbound network listener. Default mode uses stdio; optional shared-host mode creates an owner-readable Unix socket inside a random owner-only directory and opens no TCP port. Pairing artifacts remain in memory, expire automatically, and never enter extension logs. One Companion extension host owns the relay at a time so parallel VS Code windows do not start competing Remote connections. Remote availability can depend on the installed Codex version, ChatGPT rollout, account/workspace eligibility, and managed policy. The underlying `remoteControl/*` app-server API is currently experimental, and OpenAI's general Remote guide does not yet document IDE-based setup.

Use **Remove Remote Connection** at the bottom of the section to refresh and revoke the supported paired-device list, then disable the relay. The permanent Remote status-bar button lets you return and pair again later.

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
| `codexUsage.sharedRemoteHostEnabled` | `false` | On Linux or macOS, enable the optional Remote Codex Terminal. It does not mirror the phone live. |

## Requirements and privacy

- VS Code, Cursor, Windsurf, or a compatible editor.
- A working Codex CLI and login.
- A Codex version exposing the experimental Remote Control methods for remote setup.

The extension runs locally and does not store Codex credentials. Usage data stays local. When remote access is explicitly enabled, Codex—not this extension—connects to OpenAI's relay under the account's existing authentication, workspace policy, sandbox, and approval settings.

Source, Linux Remote setup, security policy, and releases are available on [GitHub](https://github.com/heycarollan/codex-usage-status).
