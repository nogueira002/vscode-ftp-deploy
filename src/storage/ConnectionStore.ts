import * as vscode from "vscode";
import { Connection, Secrets } from "../types";

const STORAGE_KEY = "ftpDeploy.connections";

export class ConnectionStore {
  constructor(private context: vscode.ExtensionContext) {}

  all(): Connection[] {
    return this.context.globalState.get<Connection[]>(STORAGE_KEY, []);
  }

  get(id: string): Connection | undefined {
    return this.all().find((conn) => conn.id === id);
  }

  async save(conn: Connection, secrets: Secrets): Promise<void> {
    conn.hasPassword = this.has(secrets.password);
    conn.hasPassphrase = this.has(secrets.passphrase);

    const list = this.all().filter((item) => item.id !== conn.id);
    list.push(conn);
    await this.context.globalState.update(STORAGE_KEY, list);

    await this.writeSecret(this.passwordKey(conn.id), secrets.password);
    await this.writeSecret(this.passphraseKey(conn.id), secrets.passphrase);
  }

  async delete(id: string): Promise<void> {
    const list = this.all().filter((item) => item.id !== id);
    await this.context.globalState.update(STORAGE_KEY, list);
    await this.context.secrets.delete(this.passwordKey(id));
    await this.context.secrets.delete(this.passphraseKey(id));
  }

  async secretsOf(id: string): Promise<Secrets> {
    return {
      password: await this.context.secrets.get(this.passwordKey(id)),
      passphrase: await this.context.secrets.get(this.passphraseKey(id)),
    };
  }

  private has(value?: string): boolean {
    return value !== undefined && value !== "";
  }

  private async writeSecret(key: string, value?: string): Promise<void> {
    if (this.has(value)) {
      await this.context.secrets.store(key, value as string);
    } else {
      await this.context.secrets.delete(key);
    }
  }

  private passwordKey(id: string): string {
    return `ftpDeploy.pw.${id}`;
  }

  private passphraseKey(id: string): string {
    return `ftpDeploy.pp.${id}`;
  }
}
