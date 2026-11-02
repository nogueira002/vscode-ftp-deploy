export type Protocol = "sftp" | "ftp";

export interface Connection {
  id: string;
  name: string;
  protocol: Protocol;
  host: string;
  port: number;
  username: string;
  remotePath: string;
  privateKeyPath?: string;
  hasPassword?: boolean;
  hasPassphrase?: boolean;
}

export interface RemoteEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
}

export interface Secrets {
  password?: string;
  passphrase?: string;
}
