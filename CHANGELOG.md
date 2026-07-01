# Changelog

## 0.1.5

- Add recent-thread polling so completed VS Code Codex chats can notify even when live app-server completion events are not delivered to the status-bar connection.
- Avoid suppressing future completion notifications when a completion event is missing a turn id.
- Show the VS Code completion toast as well when native notifications are enabled so the Show Usage action is visible.

## 0.1.4

- Replace the retired Shields.io Marketplace badge with a working Marketplace version badge.

## 0.1.3

- Clarify that reset credits can be viewed and used from VS Code, not just displayed.
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
