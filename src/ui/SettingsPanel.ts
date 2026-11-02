import * as vscode from "vscode";
import { ConnectionStore } from "../storage/ConnectionStore";
import { TransferService } from "../services/TransferService";
import { ConfigPanel } from "./ConfigPanel";
import { RemoteTreeProvider } from "./RemoteTreeProvider";
import { renderSettings } from "./settingsHtml";

export class SettingsPanel {
  private static current: SettingsPanel | undefined;

  static show(
    store: ConnectionStore,
    service: TransferService,
    tree: RemoteTreeProvider
  ): void {
    if (SettingsPanel.current) {
      SettingsPanel.current.panel.reveal(vscode.ViewColumn.One);
      SettingsPanel.current.render();
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      "ftpDeploySettings",
      "FTP Deploy — Settings",
      vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true }
    );
    SettingsPanel.current = new SettingsPanel(panel, store, service, tree);
  }

  static refresh(): void {
    SettingsPanel.current?.render();
  }

  private constructor(
    private panel: vscode.WebviewPanel,
    private store: ConnectionStore,
    private service: TransferService,
    private tree: RemoteTreeProvider
  ) {
    this.render();
    this.panel.onDidDispose(() => {
      SettingsPanel.current = undefined;
    });
    this.panel.webview.onDidReceiveMessage((message) => this.handle(message));
  }

  private render(): void {
    this.panel.webview.html = renderSettings(
      this.store.all(),
      this.store.isAutoUploadEnabled(),
      this.store.getConcurrency()
    );
  }

  private async handle(message: any): Promise<void> {
    if (message.type === "toggleAuto") {
      await this.store.setAutoUpload(message.value);
      return;
    }
    if (message.type === "setConcurrency") {
      await this.store.setConcurrency(Number(message.value));
      this.render();
      return;
    }
    if (message.type === "add") {
      ConfigPanel.show(this.store, () => this.afterChange());
      return;
    }
    if (message.type === "edit") {
      const conn = this.store.get(message.id);
      if (conn) {
        ConfigPanel.show(this.store, () => this.afterChange(), conn);
      }
      return;
    }
    if (message.type === "remove") {
      const conn = this.store.get(message.id);
      if (!conn) {
        return;
      }
      const answer = await vscode.window.showWarningMessage(
        `Remove server "${conn.name}"?`,
        { modal: true },
        "Remove"
      );
      if (answer === "Remove") {
        await this.store.delete(conn.id);
        this.afterChange();
      }
      return;
    }
    if (message.type === "test") {
      const conn = this.store.get(message.id);
      if (conn) {
        await this.test(conn.id);
      }
    }
  }

  private async test(id: string): Promise<void> {
    const conn = this.store.get(id);
    if (!conn) {
      return;
    }
    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: `Testing "${conn.name}"...` },
      async () => {
        try {
          const count = await this.service.test(conn);
          vscode.window.showInformationMessage(
            `"${conn.name}" OK — ${count} item(s) in ${conn.remotePath}.`
          );
        } catch (error) {
          vscode.window.showErrorMessage(
            `"${conn.name}" failed: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    );
  }

  private afterChange(): void {
    this.render();
    this.tree.refresh();
  }
}
