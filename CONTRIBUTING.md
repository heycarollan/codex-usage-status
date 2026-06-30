# Contributing

Thanks for helping improve Codex Usage Status.

## Development

```sh
npm install
npm run compile
npm test
```

Use `F5` in VS Code to launch an Extension Development Host after adding a launch configuration, or package locally with:

```sh
npm run package
code --install-extension dist/codex-usage-status-0.1.0.vsix --force
```

## Pull Requests

- Keep changes focused.
- Add or update tests for formatter and normalization behavior.
- Do not commit generated credentials, Codex auth files, or local account data.
- Run `npm test` before opening a PR.
