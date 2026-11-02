import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { createClient } from "../remote/clientFactory";
import { RemoteClient } from "../remote/RemoteClient";
import { joinRemote } from "../remote/remotePath";
import { ConnectionStore } from "../storage/ConnectionStore";
import { isExcludedName } from "./excludes";
import { Connection, RemoteEntry } from "../types";

export interface TransferProgress {
  update(
    fileName: string,
    filesDone: number,
    filesTotal: number,
    bytesDone: number,
    bytesTotal: number
  ): void;
  cancelled(): boolean;
}

interface FilePair {
  remote: string;
  local: string;
  size: number;
}

export class TransferService {
  constructor(private store: ConnectionStore) {}

  async test(conn: Connection): Promise<number> {
    return this.run(conn, async (client) => {
      const entries = await client.list(conn.remotePath);
      return entries.length;
    });
  }

  async download(
    conn: Connection,
    remotePath: string,
    isDirectory: boolean,
    localTarget: string,
    progress?: TransferProgress
  ): Promise<void> {
    await this.run(conn, async (client) => {
      if (!isDirectory) {
        await this.downloadOne(client, remotePath, localTarget, progress);
        return;
      }
      progress?.update("Scanning...", 0, 0, 0, 0);
      const files = await this.collectRemote(client, remotePath, localTarget, progress);
      await this.transfer(files, progress, (file) =>
        client.downloadFile(file.remote, file.local)
      );
    });
  }

  async uploadPath(
    conn: Connection,
    localPath: string,
    remotePath: string,
    isDirectory: boolean,
    progress?: TransferProgress
  ): Promise<void> {
    await this.run(conn, async (client) => {
      if (!isDirectory) {
        await this.uploadOne(client, localPath, remotePath, progress);
        return;
      }
      progress?.update("Scanning...", 0, 0, 0, 0);
      const files = this.collectLocal(localPath, remotePath);
      await this.transfer(files, progress, (file) =>
        client.uploadFile(file.local, file.remote)
      );
    });
  }

  async fetchToTemp(conn: Connection, entry: RemoteEntry): Promise<string> {
    const target = path.join(os.tmpdir(), "ftp-deploy", conn.id, entry.name);
    await this.run(conn, (client) => client.downloadFile(entry.path, target));
    return target;
  }

  private async transfer(
    files: FilePair[],
    progress: TransferProgress | undefined,
    move: (file: FilePair) => Promise<void>
  ): Promise<void> {
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    let doneFiles = 0;
    let doneBytes = 0;
    for (const file of files) {
      if (progress?.cancelled()) {
        return;
      }
      progress?.update(
        path.basename(file.local),
        doneFiles,
        files.length,
        doneBytes,
        totalBytes
      );
      await move(file);
      doneFiles += 1;
      doneBytes += file.size;
    }
    progress?.update("", doneFiles, files.length, doneBytes, totalBytes);
  }

  private async downloadOne(
    client: RemoteClient,
    remotePath: string,
    localTarget: string,
    progress?: TransferProgress
  ): Promise<void> {
    const name = path.basename(remotePath);
    progress?.update(name, 0, 1, 0, 1);
    await client.downloadFile(remotePath, localTarget);
    progress?.update(name, 1, 1, 1, 1);
  }

  private async uploadOne(
    client: RemoteClient,
    localPath: string,
    remotePath: string,
    progress?: TransferProgress
  ): Promise<void> {
    const name = path.basename(localPath);
    const size = fs.statSync(localPath).size || 1;
    progress?.update(name, 0, 1, 0, size);
    await client.uploadFile(localPath, remotePath);
    progress?.update(name, 1, 1, size, size);
  }

  private async collectRemote(
    client: RemoteClient,
    remoteDir: string,
    localDir: string,
    progress?: TransferProgress
  ): Promise<FilePair[]> {
    const result: FilePair[] = [];
    if (progress?.cancelled()) {
      return result;
    }
    const entries = await client.list(remoteDir);
    for (const entry of entries) {
      if (isExcludedName(entry.name)) {
        continue;
      }
      const local = path.join(localDir, entry.name);
      if (entry.isDirectory) {
        result.push(...(await this.collectRemote(client, entry.path, local, progress)));
      } else {
        result.push({ remote: entry.path, local, size: entry.size });
      }
    }
    return result;
  }

  private collectLocal(localDir: string, remoteDir: string): FilePair[] {
    const result: FilePair[] = [];
    for (const entry of fs.readdirSync(localDir, { withFileTypes: true })) {
      if (isExcludedName(entry.name)) {
        continue;
      }
      const local = path.join(localDir, entry.name);
      const remote = joinRemote(remoteDir, entry.name);
      if (entry.isDirectory()) {
        result.push(...this.collectLocal(local, remote));
      } else {
        result.push({ remote, local, size: fs.statSync(local).size });
      }
    }
    return result;
  }

  private async run<T>(
    conn: Connection,
    action: (client: RemoteClient) => Promise<T>
  ): Promise<T> {
    const secrets = await this.store.secretsOf(conn.id);
    const client = createClient(conn, secrets);
    try {
      await client.connect();
      return await action(client);
    } finally {
      await client.end();
    }
  }
}
