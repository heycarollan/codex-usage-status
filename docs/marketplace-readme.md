# Codex Companion: Usage & Remote

[![VS Code Marketplace](https://badgen.net/vs-marketplace/v/synapticraft.codex-usage-status)](https://marketplace.visualstudio.com/items?itemName=synapticraft.codex-usage-status)
[![GitHub release](https://badgen.net/github/release/heycarollan/codex-usage-status)](https://github.com/heycarollan/codex-usage-status/releases/latest)

Monitor Codex usage, receive completion alerts, return to exact chats, manage reset credits, and pair ChatGPT Remote from one VS Code settings page.

> **Linux without VS Code?** This project also documents the official standalone Codex Remote host. Use the [one-block Linux setup on GitHub](https://github.com/heycarollan/codex-usage-status#linux-remote-control-without-vs-code)—no VS Code extension or separate desktop controller is required.

## Features

- Display Codex 5-hour and 7-day usage in the status bar, using `N/A` when Codex does not provide a window.
- Show account, token, model-bucket, reset-credit, and expiration details in a unified settings editor.
- Notify for usage warnings, completed Codex turns, and input or approval requests.
- Open the exact completed local Codex chat, the general Codex sidebar, or no chat action.
- Use the available reset credit nearest expiration after a modal confirmation.
- Enable Codex's official Remote Control relay, create and copy a short-lived manual pairing code, inspect connection state, and revoke paired ChatGPT devices.
- Open Remote setup directly from a persistent status-bar button beside usage, with one-time first-install guidance and no Command Palette step.

## Set up ChatGPT Remote

Remote access is disabled by default.

1. Select the **Remote** button beside Codex usage in the status bar. On first install, Codex Companion highlights it and shows a one-time setup message.
2. Select **Enable and create pairing code**.
3. Open **Remote** in the ChatGPT mobile app and enter the displayed code.
4. Keep the host computer awake, online, and running VS Code.

Once paired, ChatGPT supplies the full Codex remote interface over OpenAI's internet relay: start or continue chats, send and steer instructions, answer questions, review outputs and diffs, and approve or reject actions from outside the local network.

The extension exposes no inbound network listener or raw app-server endpoint. Pairing artifacts remain in memory, expire automatically, and never enter extension logs. Remote availability can depend on the installed Codex version, ChatGPT rollout, account/workspace eligibility, and managed policy. The underlying `remoteControl/*` app-server API is currently experimental, and OpenAI's general Remote guide does not yet document IDE-based setup. This feature will require real-device pairing verification before release.

## Commands

- `Codex Companion: Refresh Usage`
- `Codex Companion: Restart App Server`
- `Codex Companion: Use Reset Credit`
- `Codex Companion: Open Settings`
- `Codex Companion: Open Logs`
- `Codex Companion: Set Up Remote Control`

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
| `codexUsage.remoteControlEnabled` | `false` | Reconnect to OpenAI's Remote Control relay while VS Code runs. |

## Requirements and privacy

- VS Code, Cursor, Windsurf, or a compatible editor.
- A working Codex CLI and login.
- A Codex version exposing the experimental Remote Control methods for remote setup.

The extension runs locally and does not store Codex credentials. Usage data stays local. When remote access is explicitly enabled, Codex—not this extension—connects to OpenAI's relay under the account's existing authentication, workspace policy, sandbox, and approval settings.

Source, Linux Remote setup, security policy, and releases are available on [GitHub](https://github.com/heycarollan/codex-usage-status).
