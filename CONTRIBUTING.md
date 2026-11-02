# Contributing

Thanks for your interest in improving FTP Deploy Connector!

## Development setup

1. Fork and clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Compile (or run it in watch mode):
   ```bash
   npm run watch
   ```
4. Press **F5** in VS Code to open the *Extension Development Host* with the
   extension loaded.

## Code layout

| File | Responsibility |
|---|---|
| `src/extension.ts` | Entry point; wires the pieces together |
| `src/commands.ts` | Registers commands and handles the UI |
| `src/types.ts` | Data model |
| `src/remote/RemoteClient.ts` | Common remote client interface |
| `src/remote/SftpClient.ts` | SFTP implementation |
| `src/remote/FtpClient.ts` | FTP implementation |
| `src/remote/clientFactory.ts` | Picks the implementation by protocol |
| `src/services/TransferService.ts` | Download, upload and connection test |
| `src/storage/ConnectionStore.ts` | Persistence and secrets |
| `src/ui/RemoteTreeProvider.ts` | Sidebar tree |
| `src/ui/ConfigPanel.ts` | Configuration panel logic |
| `src/ui/configFormHtml.ts` | Configuration form HTML |

## Before opening a Pull Request

- Make sure `npm run compile` runs without errors.
- Clearly describe what you changed and why.
- One feature or fix per PR whenever possible.

## Reporting issues

Open an [issue](https://github.com/nogueira002/vscode-ftp-deploy/issues) with
steps to reproduce, your VS Code version, and your operating system.
