import * as vscode from "vscode";
import { registerCommands } from "./commands";
import { ConnectionStore } from "./storage/ConnectionStore";
import { RemoteTreeProvider } from "./ui/RemoteTreeProvider";

export function activate(context: vscode.ExtensionContext): void {
  const store = new ConnectionStore(context);
  const tree = new RemoteTreeProvider(store);

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("ftpDeployServers", tree)
  );

  registerCommands(context, store, tree);
}

export function deactivate(): void {
  return;
}
