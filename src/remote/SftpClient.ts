import * as fs from "fs";
import * as path from "path";
import Sftp from "ssh2-sftp-client";
import { Connection, RemoteEntry, Secrets } from "../types";
import { RemoteClient } from "./RemoteClient";
import { joinRemote } from "./remotePath";

export class SftpClient implements RemoteClient {
  private client = new Sftp();

  constructor(private conn: Connection, private secrets: Secrets) {}

  async connect(): Promise<void> {
    const options: Sftp.ConnectOptions = {
      host: this.conn.host,
      port: this.conn.port,
      username: this.conn.username,
      readyTimeout: 15000,
    };
    if (this.secrets.password) {
      options.password = this.secrets.password;
    }
    if (this.conn.privateKeyPath) {
      options.privateKey = fs.readFileSync(this.conn.privateKeyPath);
      if (this.secrets.passphrase) {
        options.passphrase = this.secrets.passphrase;
      }
    }
    await this.client.connect(options);
  }

  async list(remoteDir: string): Promise<RemoteEntry[]> {
    const items = await this.client.list(remoteDir);
    return items
      .filter((item) => item.name !== "." && item.name !== "..")
      .map((item) => ({
        name: item.name,
        path: joinRemote(remoteDir, item.name),
        isDirectory: item.type === "d",
        size: item.size,
      }));
  }

  async downloadFile(remotePath: string, localPath: string): Promise<void> {
    fs.mkdirSync(path.dirname(localPath), { recursive: true });
    await this.client.fastGet(remotePath, localPath);
  }

  async downloadDir(remoteDir: string, localDir: string): Promise<void> {
    fs.mkdirSync(localDir, { recursive: true });
    const entries = await this.list(remoteDir);
    for (const entry of entries) {
      const target = path.join(localDir, entry.name);
      if (entry.isDirectory) {
        await this.downloadDir(entry.path, target);
      } else {
        await this.downloadFile(entry.path, target);
      }
    }
  }

  async uploadFile(localPath: string, remotePath: string): Promise<void> {
    await this.ensureDir(path.posix.dirname(remotePath));
    await this.client.fastPut(localPath, remotePath);
  }

  async end(): Promise<void> {
    try {
      await this.client.end();
    } catch {
      return;
    }
  }

  private async ensureDir(dir: string): Promise<void> {
    try {
      await this.client.mkdir(dir, true);
    } catch {
      return;
    }
  }
}
