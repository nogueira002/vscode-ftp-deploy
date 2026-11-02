import * as os from "os";
import * as path from "path";
import { createClient } from "../remote/clientFactory";
import { ConnectionStore } from "../storage/ConnectionStore";
import { Connection, RemoteEntry } from "../types";

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
    localTarget: string
  ): Promise<void> {
    await this.run(conn, async (client) => {
      if (isDirectory) {
        await client.downloadDir(remotePath, localTarget);
      } else {
        await client.downloadFile(remotePath, localTarget);
      }
    });
  }

  async uploadPath(
    conn: Connection,
    localPath: string,
    remotePath: string,
    isDirectory: boolean
  ): Promise<void> {
    await this.run(conn, (client) =>
      isDirectory
        ? client.uploadDir(localPath, remotePath)
        : client.uploadFile(localPath, remotePath)
    );
  }

  async fetchToTemp(conn: Connection, entry: RemoteEntry): Promise<string> {
    const target = path.join(os.tmpdir(), "ftp-deploy", conn.id, entry.name);
    await this.run(conn, (client) => client.downloadFile(entry.path, target));
    return target;
  }

  private async run<T>(
    conn: Connection,
    action: (client: ReturnType<typeof createClient>) => Promise<T>
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
