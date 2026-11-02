import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { ConnectionStore } from "./storage/ConnectionStore";
import {
  TransferService,
  TransferProgress,
  ConflictDecision,
} from "./services/TransferService";
import { isExcludedName } from "./services/excludes";
import { ConfigPanel } from "./ui/ConfigPanel";
import { SettingsPanel } from "./ui/SettingsPanel";
import { RemoteTreeProvider, TreeNode } from "./ui/RemoteTreeProvider";
import { Connection } from "./types";

const SKIP = "__skip__";

export function registerCommands(
  context: vscode.ExtensionContext,
  store: ConnectionStore,
  tree: RemoteTreeProvider
): void {
  const service = new TransferService(store);
  const autoTargets = new Map<string, string>();

  const register = (id: string, handler: (...args: any[]) => unknown) =>
    context.subscriptions.push(vscode.commands.registerCommand(id, handler));

  const onServersChanged = () => {
    tree.refresh();
    SettingsPanel.refresh();
  };

  register("ftpDeploy.refresh", () => tree.refresh());

  register("ftpDeploy.openSettings", () =>
    SettingsPanel.show(store, service, tree)
  );

  register("ftpDeploy.addConnection", () =>
    ConfigPanel.show(store, onServersChanged)
  );

  register("ftpDeploy.editConnection", (node?: TreeNode) => {
    if (node) {
      ConfigPanel.show(store, onServersChanged, node.conn);
    }
  });

  register("ftpDeploy.deleteConnection", (node?: TreeNode) =>
    deleteConnection(store, onServersChanged, node?.conn)
  );

  register("ftpDeploy.testConnection", (node?: TreeNode) =>
    testConnection(service, node?.conn)
  );

  register("ftpDeploy.openRemoteFile", (node?: TreeNode) =>
    openRemoteFile(service, node)
  );

  register("ftpDeploy.download", (node?: TreeNode) => download(service, node));

  register("ftpDeploy.uploadFile", () =>
    uploadWithPick(store, service, activeFilePath())
  );

  register("ftpDeploy.uploadToServer", (uri?: vscode.Uri) =>
    uploadWithPick(store, service, uri?.fsPath ?? activeFilePath())
  );

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((doc) =>
      autoUpload(store, service, autoTargets, doc.uri.fsPath)
    )
  );
}

async function deleteConnection(
  store: ConnectionStore,
  onChanged: () => void,
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
    onChanged();
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

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Downloading "${name}"`,
      cancellable: true,
    },
    async (progress, token) => {
      try {
        await service.download(
          node.conn,
          remotePath,
          isDirectory,
          localTarget,
          makeReporter(progress, token),
          confirmOverwrite
        );
        vscode.window.showInformationMessage(
          token.isCancellationRequested
            ? "Download cancelled."
            : `Download complete: ${localTarget}`
        );
      } catch (error) {
        vscode.window.showErrorMessage(`Download failed: ${message(error)}`);
      }
    }
  );
}

async function uploadWithPick(
  store: ConnectionStore,
  service: TransferService,
  localPath?: string
): Promise<void> {
  if (!localPath) {
    vscode.window.showErrorMessage("No file selected to upload.");
    return;
  }
  const conn = await pickConnection(store);
  if (conn) {
    await uploadResource(service, conn, localPath);
  }
}

async function autoUpload(
  store: ConnectionStore,
  service: TransferService,
  autoTargets: Map<string, string>,
  localPath: string
): Promise<void> {
  if (!store.isAutoUploadEnabled()) {
    return;
  }
  const localRoot = workspaceRoot();
  if (!localRoot || !isInside(localRoot, localPath) || isExcluded(localPath)) {
    return;
  }
  const connections = store.all();
  if (connections.length === 0) {
    return;
  }

  let conn: Connection | undefined;
  if (connections.length === 1) {
    conn = connections[0];
  } else {
    const remembered = autoTargets.get(localPath);
    if (remembered === SKIP) {
      return;
    }
    conn = remembered
      ? connections.find((item) => item.id === remembered)
      : undefined;
    if (!conn) {
      conn = await pickConnection(
        store,
        `Auto-upload "${path.basename(localPath)}" to which server?`
      );
      autoTargets.set(localPath, conn ? conn.id : SKIP);
    }
  }
  if (conn) {
    await uploadResource(service, conn, localPath);
  }
}

async function uploadResource(
  service: TransferService,
  conn: Connection,
  localPath: string
): Promise<void> {
  const localRoot = workspaceRoot();
  if (!localRoot || !isInside(localRoot, localPath)) {
    vscode.window.showErrorMessage("The file must be inside the open folder.");
    return;
  }
  const isDirectory = fs.statSync(localPath).isDirectory();
  const relative = path.relative(localRoot, localPath).split(path.sep).join("/");
  const remotePath = conn.remotePath.replace(/\/$/, "") + "/" + relative;

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Uploading "${path.basename(localPath)}" to "${conn.name}"`,
      cancellable: true,
    },
    async (progress, token) => {
      try {
        await service.uploadPath(
          conn,
          localPath,
          remotePath,
          isDirectory,
          makeReporter(progress, token)
        );
        vscode.window.showInformationMessage(
          token.isCancellationRequested ? "Upload cancelled." : `Uploaded: ${remotePath}`
        );
      } catch (error) {
        vscode.window.showErrorMessage(`Upload failed: ${message(error)}`);
      }
    }
  );
}

async function pickConnection(
  store: ConnectionStore,
  placeHolder = "Upload to which server?"
): Promise<Connection | undefined> {
  const connections = store.all();
  if (connections.length === 0) {
    vscode.window.showErrorMessage("No servers configured.");
    return undefined;
  }
  if (connections.length === 1) {
    return connections[0];
  }
  const choice = await vscode.window.showQuickPick(
    connections.map((conn) => ({
      label: conn.name,
      description: conn.host,
      conn,
    })),
    { placeHolder }
  );
  return choice?.conn;
}

function activeFilePath(): string | undefined {
  return vscode.window.activeTextEditor?.document.uri.fsPath;
}

function workspaceRoot(): string | undefined {
  const folders = vscode.workspace.workspaceFolders;
  return folders && folders.length > 0 ? folders[0].uri.fsPath : undefined;
}

function isInside(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return !relative.startsWith("..") && !path.isAbsolute(relative);
}

function isExcluded(localPath: string): boolean {
  return localPath.split(path.sep).some((segment) => isExcludedName(segment));
}

function withProgress(title: string, task: () => Promise<void>): Thenable<void> {
  return vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title },
    task
  );
}

async function confirmOverwrite(existingCount: number): Promise<ConflictDecision> {
  const label =
    existingCount === 1
      ? "1 file already exists locally. Overwrite it?"
      : `${existingCount} files already exist locally. Overwrite them?`;
  const choice = await vscode.window.showWarningMessage(
    label,
    { modal: true },
    "Overwrite",
    "Skip existing"
  );
  if (choice === "Overwrite") {
    return "overwrite";
  }
  if (choice === "Skip existing") {
    return "skip";
  }
  return "cancel";
}

function makeReporter(
  progress: vscode.Progress<{ message?: string; increment?: number }>,
  token: vscode.CancellationToken
): TransferProgress {
  const start = Date.now();
  let lastPercent = 0;
  return {
    cancelled: () => token.isCancellationRequested,
    update: (fileName, filesDone, filesTotal, bytesDone, bytesTotal) => {
      if (filesTotal === 0) {
        progress.report({ message: "Scanning..." });
        return;
      }
      const percent =
        bytesTotal > 0
          ? (bytesDone / bytesTotal) * 100
          : (filesDone / filesTotal) * 100;
      const increment = percent > lastPercent ? percent - lastPercent : 0;
      lastPercent = percent;
      const label = fileName
        ? `${filesDone}/${filesTotal} · ${fileName}`
        : `${filesDone}/${filesTotal}`;
      const eta = formatEta(start, percent);
      progress.report({
        increment,
        message: eta ? `${label} · ~${eta} left` : label,
      });
    },
  };
}

function formatEta(start: number, percent: number): string {
  if (percent <= 0 || percent >= 100) {
    return "";
  }
  const elapsed = (Date.now() - start) / 1000;
  const remaining = Math.max(0, elapsed / (percent / 100) - elapsed);
  const minutes = Math.floor(remaining / 60);
  const seconds = Math.round(remaining % 60);
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
