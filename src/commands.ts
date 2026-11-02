import * as path from "path";
import * as vscode from "vscode";
import { ConnectionStore } from "./storage/ConnectionStore";
import { TransferService } from "./services/TransferService";
import { ConfigPanel } from "./ui/ConfigPanel";
import { RemoteTreeProvider, TreeNode } from "./ui/RemoteTreeProvider";
import { Connection } from "./types";

export function registerCommands(
  context: vscode.ExtensionContext,
  store: ConnectionStore,
  tree: RemoteTreeProvider
): void {
  const service = new TransferService(store);
  const register = (id: string, handler: (...args: any[]) => unknown) =>
    context.subscriptions.push(vscode.commands.registerCommand(id, handler));

  register("ftpDeploy.refresh", () => tree.refresh());

  register("ftpDeploy.addConnection", () =>
    ConfigPanel.show(store, () => tree.refresh())
  );

  register("ftpDeploy.editConnection", (node?: TreeNode) => {
    if (node) {
      ConfigPanel.show(store, () => tree.refresh(), node.conn);
    }
  });

  register("ftpDeploy.deleteConnection", (node?: TreeNode) =>
    deleteConnection(store, tree, node?.conn)
  );

  register("ftpDeploy.testConnection", (node?: TreeNode) =>
    testConnection(service, node?.conn)
  );

  register("ftpDeploy.openRemoteFile", (node?: TreeNode) =>
    openRemoteFile(service, node)
  );

  register("ftpDeploy.download", (node?: TreeNode) =>
    download(service, node)
  );

  register("ftpDeploy.uploadFile", () => uploadFile(store, service));
}

async function deleteConnection(
  store: ConnectionStore,
  tree: RemoteTreeProvider,
  conn?: Connection
): Promise<void> {
  if (!conn) {
    return;
  }
  const answer = await vscode.window.showWarningMessage(
    `Remove server "${conn.name}"?`,
    { modal: true },
    "Remove"
  );
  if (answer === "Remove") {
    await store.delete(conn.id);
    tree.refresh();
  }
}

async function testConnection(
  service: TransferService,
  conn?: Connection
): Promise<void> {
  if (!conn) {
    return;
  }
  await withProgress(`Testing "${conn.name}"...`, async () => {
    try {
      const count = await service.test(conn);
      vscode.window.showInformationMessage(
        `"${conn.name}" OK — ${count} item(s) in ${conn.remotePath}.`
      );
    } catch (error) {
      vscode.window.showErrorMessage(`"${conn.name}" failed: ${message(error)}`);
    }
  });
}

async function openRemoteFile(
  service: TransferService,
  node?: TreeNode
): Promise<void> {
  if (!node || node.kind !== "entry" || node.entry.isDirectory) {
    return;
  }
  try {
    const localPath = await service.fetchToTemp(node.conn, node.entry);
    const doc = await vscode.workspace.openTextDocument(localPath);
    await vscode.window.showTextDocument(doc);
  } catch (error) {
    vscode.window.showErrorMessage(`Could not open: ${message(error)}`);
  }
}

async function download(
  service: TransferService,
  node?: TreeNode
): Promise<void> {
  if (!node) {
    return;
  }
  const localRoot = workspaceRoot();
  if (!localRoot) {
    vscode.window.showErrorMessage("Open a folder to download into first.");
    return;
  }

  const isDirectory = node.kind === "connection" || node.entry.isDirectory;
  const remotePath =
    node.kind === "connection" ? node.conn.remotePath : node.entry.path;
  const name = node.kind === "connection" ? "." : node.entry.name;
  const localTarget =
    node.kind === "connection" ? localRoot : path.join(localRoot, name);

  await withProgress(`Downloading "${name}"...`, async () => {
    try {
      await service.download(node.conn, remotePath, isDirectory, localTarget);
      vscode.window.showInformationMessage(`Download complete: ${localTarget}`);
    } catch (error) {
      vscode.window.showErrorMessage(`Download failed: ${message(error)}`);
    }
  });
}

async function uploadFile(
  store: ConnectionStore,
  service: TransferService
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage("No active file to upload.");
    return;
  }
  const localPath = editor.document.uri.fsPath;
  const localRoot = workspaceRoot();
  if (!localRoot || !localPath.startsWith(localRoot)) {
    vscode.window.showErrorMessage("The file must be inside the open folder.");
    return;
  }

  const conn = await pickConnection(store);
  if (!conn) {
    return;
  }

  const relative = path.relative(localRoot, localPath).split(path.sep).join("/");
  const remotePath = conn.remotePath.replace(/\/$/, "") + "/" + relative;

  await withProgress(`Uploading to "${conn.name}"...`, async () => {
    try {
      await service.upload(conn, localPath, remotePath);
      vscode.window.showInformationMessage(`Uploaded: ${remotePath}`);
    } catch (error) {
      vscode.window.showErrorMessage(`Upload failed: ${message(error)}`);
    }
  });
}

async function pickConnection(
  store: ConnectionStore
): Promise<Connection | undefined> {
  const connections = store.all();
  if (connections.length === 0) {
    vscode.window.showErrorMessage("No servers configured.");
    return undefined;
  }
  const choice = await vscode.window.showQuickPick(
    connections.map((conn) => ({
      label: conn.name,
      description: conn.host,
      conn,
    })),
    { placeHolder: "Upload to which server?" }
  );
  return choice?.conn;
}

function workspaceRoot(): string | undefined {
  const folders = vscode.workspace.workspaceFolders;
  return folders && folders.length > 0 ? folders[0].uri.fsPath : undefined;
}

function withProgress(title: string, task: () => Promise<void>): Thenable<void> {
  return vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title },
    task
  );
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
