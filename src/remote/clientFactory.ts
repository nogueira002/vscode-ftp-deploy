import { Connection, Secrets } from "../types";
import { RemoteClient } from "./RemoteClient";
import { SftpClient } from "./SftpClient";
import { FtpClient } from "./FtpClient";

export function createClient(conn: Connection, secrets: Secrets): RemoteClient {
  if (conn.protocol === "sftp") {
    return new SftpClient(conn, secrets);
  }
  return new FtpClient(conn, secrets);
}
