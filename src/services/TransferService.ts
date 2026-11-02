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

export type ConflictDecision = "overwrite" | "skip" | "cancel";

export type ConflictResolver = (existingCount: number) => Promise<ConflictDecision>;

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
    progress?: TransferProgress,
    confirm?: ConflictResolver
  ): Promise<void> {
    await this.transferParallel(
      conn,
      progress,
      confirm,
      async (client) => {
        if (!isDirectory) {
          return [{ remote: remotePath, local: localTarget, size: 1 }];
        }
        progress?.update("Scanning...", 0, 0, 0, 0);
        return this.collectRemote(client, remotePath, localTarget, progress);
      },
      (client, file) => client.downloadFile(file.remote, file.local)
    );
  }

  async uploadPath(
    conn: Connection,
    localPath: string,
    remotePath: string,
    isDirectory: boolean,
    progress?: TransferProgress
  ): Promise<void> {
    await this.transferParallel(
      conn,
      progress,
      undefined,
      async () => {
        if (!isDirectory) {
          const size = fs.statSync(localPath).size || 1;
          return [{ local: localPath, remote: remotePath, size }];
        }
        progress?.update("Scanning...", 0, 0, 0, 0);
        return this.collectLocal(localPath, remotePath);
      },
      (client, file) => client.uploadFile(file.local, file.remote)
    );
  }

  async fetchToTemp(conn: Connection, entry: RemoteEntry): Promise<string> {
    const target = path.join(os.tmpdir(), "ftp-deploy", conn.id, entry.name);
    await this.run(conn, (client) => client.downloadFile(entry.path, target));
    return target;
  }

  private async transferParallel(
    conn: Connection,
    progress: TransferProgress | undefined,
    confirm: ConflictResolver | undefined,
    collect: (client: RemoteClient) => Promise<FilePair[]>,
    move: (client: RemoteClient, file: FilePair) => Promise<void>
  ): Promise<void> {
    const secrets = await this.store.secretsOf(conn.id);
    const clients: RemoteClient[] = [];
    try {
      const first = createClient(conn, secrets);
      await first.connect();
      clients.push(first);

      const files = await collect(first);
      const resolved = await this.resolveConflicts(files, confirm);
      if (!resolved || resolved.length === 0) {
        return;
      }

      const extra = Math.min(this.store.getConcurrency(), resolved.length) - 1;
      const more = await Promise.allSettled(
        Array.from({ length: Math.max(0, extra) }, async () => {
          const client = createClient(conn, secrets);
          await client.connect();
          return client;
        })
      );
      for (const result of more) {
        if (result.status === "fulfilled") {
          clients.push(result.value);
        }
      }

      await this.runWorkers(clients, resolved, progress, move);
    } finally {
      await Promise.all(clients.map((client) => client.end().catch(() => undefined)));
    }
  }

  private async runWorkers(
    clients: RemoteClient[],
    files: FilePair[],
    progress: TransferProgress | undefined,
    move: (client: RemoteClient, file: FilePair) => Promise<void>
  ): Promise<void> {
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    let next = 0;
    let doneFiles = 0;
    let doneBytes = 0;

    const worker = async (client: RemoteClient): Promise<void> => {
      while (true) {
        if (progress?.cancelled()) {
          return;
        }
        const index = next++;
        if (index >= files.length) {
          return;
        }
        const file = files[index];
        progress?.update(
          path.basename(file.local),
          doneFiles,
          files.length,
          doneBytes,
          totalBytes
        );
        await move(client, file);
        doneFiles += 1;
        doneBytes += file.size;
      }
    };

    await Promise.all(clients.map((client) => worker(client)));
    progress?.update("", doneFiles, files.length, doneBytes, totalBytes);
  }

  private async resolveConflicts(
    files: FilePair[],
    confirm?: ConflictResolver
  ): Promise<FilePair[] | undefined> {
    if (!confirm) {
      return files;
    }
    const existing = files.filter((file) => fs.existsSync(file.local));
    if (existing.length === 0) {
      return files;
    }
    const decision = await confirm(existing.length);
    if (decision === "cancel") {
      return undefined;
    }
    if (decision === "skip") {
      return files.filter((file) => !fs.existsSync(file.local));
    }
    return files;
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
      if (isExcludedName(entry.name) || entry.isSymlink) {
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
