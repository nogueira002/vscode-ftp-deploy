import * as vscode from "vscode";
import { Connection, Secrets } from "../types";

const STORAGE_KEY = "ftpDeploy.connections";
const AUTO_UPLOAD_KEY = "ftpDeploy.autoUpload";
const CONCURRENCY_KEY = "ftpDeploy.concurrency";
const DEFAULT_CONCURRENCY = 4;
const MIN_CONCURRENCY = 1;
const MAX_CONCURRENCY = 16;

export class ConnectionStore {
  constructor(private context: vscode.ExtensionContext) {}

  all(): Connection[] {
    return this.context.globalState.get<Connection[]>(STORAGE_KEY, []);
  }

  isAutoUploadEnabled(): boolean {
    return this.context.globalState.get<boolean>(AUTO_UPLOAD_KEY, true);
  }

  async setAutoUpload(enabled: boolean): Promise<void> {
    await this.context.globalState.update(AUTO_UPLOAD_KEY, enabled);
  }

  getConcurrency(): number {
    const value = this.context.globalState.get<number>(
      CONCURRENCY_KEY,
      DEFAULT_CONCURRENCY
    );
    return this.clampConcurrency(value);
  }

  async setConcurrency(value: number): Promise<void> {
    await this.context.globalState.update(
      CONCURRENCY_KEY,
      this.clampConcurrency(value)
    );
  }

  private clampConcurrency(value: number): number {
    if (!Number.isFinite(value)) {
      return DEFAULT_CONCURRENCY;
    }
    return Math.min(MAX_CONCURRENCY, Math.max(MIN_CONCURRENCY, Math.round(value)));
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
