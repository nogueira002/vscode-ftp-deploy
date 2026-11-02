import * as vscode from "vscode";
import { createClient } from "../remote/clientFactory";
import { ConnectionStore } from "../storage/ConnectionStore";
import { Connection, Secrets } from "../types";
import { renderConfigForm } from "./configFormHtml";

interface FormData {
  name: string;
  protocol: string;
  port: string;
  host: string;
  username: string;
  password: string;
  privateKeyPath: string;
  passphrase: string;
  remotePath: string;
}

export class ConfigPanel {
  static show(
    store: ConnectionStore,
    onSaved: () => void,
    existing?: Connection
  ): void {
    const panel = vscode.window.createWebviewPanel(
      "ftpDeployConfig",
      existing ? `Edit: ${existing.name}` : "New server",
      vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true }
    );
    new ConfigPanel(panel, store, onSaved, existing);
  }

  private constructor(
    private panel: vscode.WebviewPanel,
    private store: ConnectionStore,
    private onSaved: () => void,
    private existing?: Connection
  ) {
    this.panel.webview.html = renderConfigForm(existing);
    this.panel.webview.onDidReceiveMessage((message) => {
      if (message.type === "test") {
        this.test(message.data);
      } else if (message.type === "save") {
        this.save(message.data);
      }
    });
  }

  private async test(data: FormData): Promise<void> {
    const conn = this.toConnection(data);
    const client = createClient(conn, this.toSecrets(data));
    this.post({ type: "testing" });
    try {
      await client.connect();
      const entries = await client.list(conn.remotePath);
      this.post({
        type: "testResult",
        ok: true,
        message: `Connected. "${conn.remotePath}" has ${entries.length} item(s).`,
      });
    } catch (error) {
      this.post({ type: "testResult", ok: false, message: `Failed: ${this.message(error)}` });
    } finally {
      await client.end();
    }
  }

  private async save(data: FormData): Promise<void> {
    const conn = this.toConnection(data);
    if (!conn.host || !conn.username) {
      this.post({
        type: "testResult",
        ok: false,
        message: "Fill in at least host and user.",
      });
      return;
    }
    await this.store.save(conn, this.toSecrets(data));
    this.onSaved();
    vscode.window.showInformationMessage(`Server "${conn.name}" saved.`);
    this.panel.dispose();
  }

  private toConnection(data: FormData): Connection {
    const protocol = data.protocol === "ftp" ? "ftp" : "sftp";
    return {
      id: this.existing?.id ?? `conn-${Date.now()}`,
      name: data.name.trim() || "Server",
      protocol,
      host: data.host.trim(),
      port: Number(data.port) || (protocol === "ftp" ? 21 : 22),
      username: data.username.trim(),
      remotePath: data.remotePath.trim() || "/",
      privateKeyPath: data.privateKeyPath.trim() || undefined,
    };
  }

  private toSecrets(data: FormData): Secrets {
    return {
      password: data.password || undefined,
      passphrase: data.passphrase || undefined,
    };
  }

  private post(message: unknown): void {
    this.panel.webview.postMessage(message);
  }

  private message(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
