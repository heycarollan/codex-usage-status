# Security Policy

## Reporting

Please do not open public issues for vulnerabilities. Report security concerns privately to the maintainer.

## Scope

This extension starts the local Codex app-server and requests account usage metadata. It should not read repository files directly, transmit usage data to third-party services, or store Codex credentials.

Remote control is opt-in and uses Codex's official OpenAI relay. The extension must not bind an unauthenticated network listener, expose the raw app-server, log or persist pairing codes, bypass Codex approval policies, or forward arbitrary VS Code commands. Pairing and device revocation must remain explicit user actions.

## Local Secrets

Do not include Codex auth files, API keys, access tokens, screenshots containing tokens, or editor logs with credentials in issues or pull requests.
