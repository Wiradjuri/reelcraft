import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Stores generated media (scene images, narration, rendered MP4s).
 * Vercel Blob in production; public/ on local disk when no blob token is set.
 */
export interface FileStorage {
  save(key: string, data: Buffer, contentType: string): Promise<string>;
}

class LocalFileStorage implements FileStorage {
  async save(key: string, data: Buffer) {
    const target = path.join(process.cwd(), "public", key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, data, { mode: 0o600 });
    return `/${key}`;
  }
}

class VercelBlobStorage implements FileStorage {
  async save(key: string, data: Buffer, contentType: string) {
    const { put } = await import("@vercel/blob");
    const blob = await put(key, data, { access: "public", contentType, addRandomSuffix: false });
    return blob.url;
  }
}

export function getStorage(): FileStorage {
  return process.env.BLOB_READ_WRITE_TOKEN ? new VercelBlobStorage() : new LocalFileStorage();
}
