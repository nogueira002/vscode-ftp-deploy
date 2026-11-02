import { RemoteEntry } from "../types";

export interface RemoteClient {
  connect(): Promise<void>;
  list(remoteDir: string): Promise<RemoteEntry[]>;
  downloadFile(remotePath: string, localPath: string): Promise<void>;
  uploadFile(localPath: string, remotePath: string): Promise<void>;
  end(): Promise<void>;
}
