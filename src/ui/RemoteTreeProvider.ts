import * as vscode from "vscode";
import { createClient } from "../remote/clientFactory";
import { ConnectionStore } from "../storage/ConnectionStore";
import { Connection, RemoteEntry } from "../types";

export type TreeNode =
  | { kind: "connection"; conn: Connection }
  | { kind: "entry"; conn: Connection; entry: RemoteEntry };

export class RemoteTreeProvider implements vscode.TreeDataProvider<TreeNode> {
  private emitter = new vscode.EventEmitter<TreeNode | undefined | void>();
  readonly onDidChangeTreeData = this.emitter.event;

  constructor(private store: ConnectionStore) {}

  refresh(): void {
    this.emitter.fire();
  }

  getTreeItem(node: TreeNode): vscode.TreeItem {
    if (node.kind === "connection") {
      return this.connectionItem(node.conn);
    }
    return this.entryItem(node);
  }

  async getChildren(node?: TreeNode): Promise<TreeNode[]> {
    if (!node) {
      return this.store.all().map((conn) => ({ kind: "connection", conn }));
    }
    const conn = node.conn;
    const dir = node.kind === "connection" ? conn.remotePath : node.entry.path;
    return this.listChildren(conn, dir);
  }

  private connectionItem(conn: Connection): vscode.TreeItem {
    const item = new vscode.TreeItem(
      conn.name,
      vscode.TreeItemCollapsibleState.Collapsed
    );
    item.description = `${conn.protocol}  ${conn.host}`;
    item.contextValue = "connection";
    item.iconPath = new vscode.ThemeIcon("server-environment");
    item.id = conn.id;
    return item;
  }

  private entryItem(node: Extract<TreeNode, { kind: "entry" }>): vscode.TreeItem {
    const entry = node.entry;
    const item = new vscode.TreeItem(
      entry.name,
      entry.isDirectory
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None
    );
    item.contextValue = entry.isDirectory ? "remoteDir" : "remoteFile";
    item.iconPath = new vscode.ThemeIcon(entry.isDirectory ? "folder" : "file");
    item.tooltip = entry.path;
    if (!entry.isDirectory) {
      item.command = {
        command: "ftpDeploy.openRemoteFile",
        title: "Open",
        arguments: [node],
      };
    }
    return item;
  }

  private async listChildren(
    conn: Connection,
    dir: string
  ): Promise<TreeNode[]> {
    const secrets = await this.store.secretsOf(conn.id);
    const client = createClient(conn, secrets);
    try {
      await client.connect();
      const entries = await client.list(dir);
      return this.sort(entries).map((entry) => ({ kind: "entry", conn, entry }));
    } catch (error) {
      vscode.window.showErrorMessage(
        `Error listing "${conn.name}": ${this.message(error)}`
      );
      return [];
    } finally {
      await client.end();
    }
  }

  private sort(entries: RemoteEntry[]): RemoteEntry[] {
    return entries.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  }

  private message(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
