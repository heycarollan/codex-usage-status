# Codex Companion 1.1.0 — Remote Control from Anywhere

Codex Companion 1.1.0 turns the Codex usage extension into a broader companion for monitoring work, returning to completed chats, managing reset credits, and controlling Codex remotely from ChatGPT over the internet.

## ChatGPT Remote setup in about a minute

For most Linux, macOS, and Windows desktop users, setup is four steps:

1. Install or update the VS Code extension.
2. Select the new **Remote** button beside Codex usage in the status bar.
3. Select **Enable and create pairing code**.
4. Enter the short-lived code in **Remote** in the ChatGPT mobile app.

First install includes a one-time welcome message and highlighted setup button. After pairing, the status-bar button shows whether Remote is off, connecting, connected, or unavailable and opens the existing settings page directly at its Remote Control section.

The paired ChatGPT Remote experience can start or continue chats, send and steer instructions, answer questions, review outputs and diffs, and approve or reject actions from outside the host's local network.

## Connection and device controls

- Create and copy a short-lived manual pairing code without logging or persisting it.
- See relay connection state and the local computer name.
- Inspect and individually revoke paired ChatGPT devices.
- Temporarily disable the relay while retaining device grants.
- Use **Remove Remote Connection** to revoke every currently listed paired device and disable the relay after a modal confirmation.
- Return and pair again at any time from the permanent Remote status-bar button.

Codex Companion does not create a public listener, proxy arbitrary app-server methods, expose a shell or filesystem endpoint, or operate a separate relay. Codex owns the authenticated outbound connection to OpenAI's Remote relay and continues to enforce the account's workspace, sandbox, and approval policies.

## Usage status and account details

- Show separate 5-hour and 7-day Codex usage windows in the status bar and settings editor.
- Match windows by reported duration, regardless of primary/secondary response ordering.
- Display `N/A` instead of inventing a value when Codex omits a window.
- Show reset times, plan and credit information, token summaries, recent daily token usage, and model-specific buckets.
- Refresh manually or automatically and restart the local app-server from the unified settings page.

## Completion and attention notifications

- Notify when reported usage crosses the configured warning threshold.
- Notify when visible Codex turns complete or need input or approval.
- Include the available chat name, project, and Git branch so parallel work remains distinguishable.
- Use VS Code notifications, native Linux notifications, or both.
- Open the exact completed local chat through the current OpenAI extension thread resource, open the general Codex sidebar, or disable the chat action.

## Reset-credit management

- Show each available reset credit's status, scope, grant time, expiration, title, and description when Codex provides them.
- Use a reset credit only after explicit modal confirmation.
- Prefer the available credit nearest expiration, with a compatibility fallback when older Codex versions omit per-credit IDs.
- Refresh usage immediately after the reset attempt.

## Linux options

The recommended Linux desktop route is the VS Code extension because it provides the tested visual setup and ongoing controls in about a minute.

Linux servers and headless computers can instead use the official standalone Codex installer and experimental `codex remote-control start`, `pair`, and `stop` commands documented in the repository README. That route does not require VS Code or a separate Synapticraft desktop application.

## Availability

Remote Control is opt-in and disabled by default. The host must remain awake and online. Availability depends on the installed Codex version, ChatGPT mobile rollout, account or workspace eligibility, and administrator policy. The underlying Codex Remote interfaces are currently experimental, so this release remains gated on final real-device pairing and removal verification before publication.
