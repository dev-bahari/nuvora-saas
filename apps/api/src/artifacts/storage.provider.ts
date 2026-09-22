export interface PutArtifactInput {
  key: string;
  body: Buffer;
  contentType: string;
}

export interface StoredArtifact {
  key: string;
  sha256: string;
  sizeBytes: number;
}

export interface StorageProvider {
  putPrivate(input: PutArtifactInput): Promise<StoredArtifact>;
  createDownloadUrl(key: string, expiresInSeconds: number): Promise<string>;
}

export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');
