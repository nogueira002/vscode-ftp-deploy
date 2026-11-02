import * as fs from "fs";
import * as path from "path";
import { Client as FtpLib } from "basic-ftp";
import { Connection, RemoteEntry, Secrets } from "../types";
import { RemoteClient } from "./RemoteClient";
import { joinRemote } from "./remotePath";

export class FtpClient implements RemoteClient {
  private client = new FtpLib(20000);

  constructor(private conn: Connection, private secrets: Secrets) {}

  async connect(): Promise<void> {
    await this.client.access({
      host: this.conn.host,
      port: this.conn.port,
      user: this.conn.username,
      password: this.secrets.password ?? "",
      secure: false,
    });
  }

  async list(remoteDir: string): Promise<RemoteEntry[]> {
    const items = await this.client.list(remoteDir);
    return items
      .filter((item) => item.name !== "." && item.name !== "..")
      .map((item) => ({
        name: item.name,
        path: joinRemote(remoteDir, item.name),
        isDirectory: item.isDirectory,
        isSymlink: item.isSymbolicLink,
        size: item.size,
      }));
  }

  async downloadFile(remotePath: string, localPath: string): Promise<void> {
    fs.mkdirSync(path.dirname(localPath), { recursive: true });
    await this.client.downloadTo(localPath, remotePath);
  }

  async uploadFile(localPath: string, remotePath: string): Promise<void> {
    await this.ensureDir(path.posix.dirname(remotePath));
    await this.client.uploadFrom(localPath, remotePath);
  }

  async end(): Promise<void> {
    this.client.close();
  }

  private async ensureDir(dir: string): Promise<void> {
    try {
      await this.client.ensureDir(dir);
    } catch {
      return;
    }
  }
}
