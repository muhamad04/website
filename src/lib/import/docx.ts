/**
 * Bounded DOCX (ZIP) inspection.
 *
 * `detectImportFileKind` already checks the ZIP magic bytes and that
 * `word/document.xml` appears in the first 64 KiB. A malicious DOCX can still
 * hide a decompression bomb behind a valid local header, so the central
 * directory is parsed before mammoth is allowed to run.
 *
 * Only metadata is read: entry count, compressed size and uncompressed size.
 * No entry is decompressed here.
 */

export const IMPORT_DOCX_MAX_ENTRIES = 2_048;
export const IMPORT_DOCX_MAX_UNCOMPRESSED_BYTES = 200 * 1024 * 1024;
export const IMPORT_DOCX_MAX_COMPRESSION_RATIO = 100;
/** Below this size a high ratio is normal (small XML files compress well). */
const IMPORT_DOCX_RATIO_FLOOR_BYTES = 10 * 1024 * 1024;

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_HEADER_SIGNATURE = 0x02014b50;
const ZIP64_MARKER = 0xffffffff;

export type DocxInspection =
  | { ok: true; entries: number; uncompressedBytes: number }
  | { ok: false; error: "file_too_large" | "file_type_invalid" };

function viewOf(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function uint16(view: DataView, offset: number): number {
  return view.getUint16(offset, true);
}

function uint32(view: DataView, offset: number): number {
  return view.getUint32(offset, true);
}

/** Scans backwards for the End Of Central Directory record. */
function findEocd(view: DataView): number | null {
  const minimum = Math.max(0, view.byteLength - 22 - 0xffff);

  for (let offset = view.byteLength - 22; offset >= minimum; offset -= 1) {
    if (uint32(view, offset) === EOCD_SIGNATURE) {
      return offset;
    }
  }

  return null;
}

export function inspectDocxArchive(bytes: Uint8Array): DocxInspection {
  if (bytes.byteLength < 22) {
    return { ok: false, error: "file_type_invalid" };
  }

  const view = viewOf(bytes);
  const eocd = findEocd(view);

  if (eocd === null || eocd + 22 > view.byteLength) {
    return { ok: false, error: "file_type_invalid" };
  }

  const entryCount = uint16(view, eocd + 10);
  const centralSize = uint32(view, eocd + 12);
  const centralOffset = uint32(view, eocd + 16);

  // ZIP64 uses 0xFFFF/0xFFFFFFFF sentinels. A 50 MiB upload cannot legitimately
  // need ZIP64, and treating it as a size failure is the safe choice.
  if (
    entryCount === 0xffff ||
    centralSize === ZIP64_MARKER ||
    centralOffset === ZIP64_MARKER
  ) {
    return { ok: false, error: "file_too_large" };
  }

  if (entryCount === 0 || entryCount > IMPORT_DOCX_MAX_ENTRIES) {
    return { ok: false, error: "file_too_large" };
  }

  if (
    centralOffset > view.byteLength ||
    centralSize > view.byteLength ||
    centralOffset + centralSize > view.byteLength
  ) {
    return { ok: false, error: "file_type_invalid" };
  }

  let offset = centralOffset;
  let uncompressedBytes = 0;
  let hasDocumentXml = false;

  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > view.byteLength) {
      return { ok: false, error: "file_type_invalid" };
    }

    if (uint32(view, offset) !== CENTRAL_HEADER_SIGNATURE) {
      return { ok: false, error: "file_type_invalid" };
    }

    const compressed = uint32(view, offset + 20);
    const uncompressed = uint32(view, offset + 24);
    const nameLength = uint16(view, offset + 28);
    const extraLength = uint16(view, offset + 30);
    const commentLength = uint16(view, offset + 32);
    const next = offset + 46 + nameLength + extraLength + commentLength;

    if (next > view.byteLength || nameLength === 0) {
      return { ok: false, error: "file_type_invalid" };
    }

    if (compressed === ZIP64_MARKER || uncompressed === ZIP64_MARKER) {
      return { ok: false, error: "file_too_large" };
    }

    const name = new TextDecoder("utf-8", { fatal: false }).decode(
      bytes.subarray(offset + 46, offset + 46 + nameLength),
    );

    if (name === "word/document.xml") {
      hasDocumentXml = true;
    }

    uncompressedBytes += uncompressed;

    if (uncompressedBytes > IMPORT_DOCX_MAX_UNCOMPRESSED_BYTES) {
      return { ok: false, error: "file_too_large" };
    }

    offset = next;
  }

  if (!hasDocumentXml) {
    return { ok: false, error: "file_type_invalid" };
  }

  if (
    uncompressedBytes > IMPORT_DOCX_RATIO_FLOOR_BYTES &&
    uncompressedBytes / Math.max(1, bytes.byteLength) >
      IMPORT_DOCX_MAX_COMPRESSION_RATIO
  ) {
    return { ok: false, error: "file_too_large" };
  }

  return { ok: true, entries: entryCount, uncompressedBytes };
}
