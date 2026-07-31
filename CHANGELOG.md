# Changelog

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
