import type { FileHandle } from "node:fs/promises";

/** Read only the validated snapshot length, never the file's later EOF. */
export async function readBoundedFileHandle(
  fileHandle: FileHandle,
  byteLength: number,
): Promise<Buffer> {
  const source = Buffer.alloc(byteLength);
  let offset = 0;
  try {
    while (offset < byteLength) {
      // oxlint-disable-next-line no-await-in-loop -- each partial read determines the next offset.
      const { bytesRead } = await fileHandle.read(
        source,
        offset,
        byteLength - offset,
        offset,
      );
      if (bytesRead === 0) {
        throw new Error("File ended before its validated size");
      }
      offset += bytesRead;
    }
    return source;
  } catch (error) {
    source.fill(0);
    throw error;
  }
}
