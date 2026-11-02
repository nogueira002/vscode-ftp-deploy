import { RemoteEntry } from "../types";

export interface RemoteClient {
  connect(): Promise<void>;
  list(remoteDir: string): Promise<RemoteEntry[]>;
  downloadFile(remotePath: string, localPath: string): Promise<void>;
  downloadDir(remoteDir: string, localDir: string): Promise<void>;
  uploadFile(localPath: string, remotePath: string): Promise<void>;
  uploadDir(localDir: string, remoteDir: string): Promise<void>;
  end(): Promise<void>;
}
