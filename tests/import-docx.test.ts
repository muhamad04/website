import { describe, expect, it } from "vitest";
import {
  IMPORT_DOCX_MAX_ENTRIES,
  IMPORT_DOCX_MAX_UNCOMPRESSED_BYTES,
  inspectDocxArchive,
} from "@/lib/import/docx";
import { buildDocx } from "./fixtures/import-fixtures";

type Entry = {
  name: string;
  compressed: number;
  uncompressed: number;
};

/**
 * Builds a syntactically valid ZIP central directory plus EOCD. The inspector
 * deliberately reads only metadata, so local file data is unnecessary here.
 */
function buildArchive(
  entries: Entry[],
  options: { entryCount?: number } = {},
): Uint8Array {
  const encoder = new TextEncoder();
  const names = entries.map((entry) => encoder.encode(entry.name));
  const centralSize = entries.reduce(
    (sum, _entry, index) => sum + 46 + names[index].length,
    0,
  );
  const bytes = new Uint8Array(centralSize + 22);
  const view = new DataView(bytes.buffer);
  let offset = 0;

  entries.forEach((entry, index) => {
    const name = names[index];

    view.setUint32(offset, 0x02014b50, true);
    view.setUint16(offset + 4, 20, true);
    view.setUint16(offset + 6, 20, true);
    view.setUint16(offset + 8, 0, true);
    view.setUint16(offset + 10, 8, true);
    view.setUint32(offset + 20, entry.compressed, true);
    view.setUint32(offset + 24, entry.uncompressed, true);
    view.setUint16(offset + 28, name.length, true);
    view.setUint16(offset + 30, 0, true);
    view.setUint16(offset + 32, 0, true);
    view.setUint32(offset + 42, 0, true);
    bytes.set(name, offset + 46);
    offset += 46 + name.length;
  });

  const eocd = offset;
  const count = options.entryCount ?? entries.length;

  view.setUint32(eocd, 0x06054b50, true);
  view.setUint16(eocd + 8, count, true);
  view.setUint16(eocd + 10, count, true);
  view.setUint32(eocd + 12, centralSize, true);
  view.setUint32(eocd + 16, 0, true);
  view.setUint16(eocd + 20, 0, true);

  return bytes;
}

const DOCUMENT_XML: Entry = {
  name: "word/document.xml",
  compressed: 100,
  uncompressed: 1_000,
};

describe("DOCX archive inspection", () => {
  it("accepts a real DOCX built by the fixture", async () => {
    const bytes = await buildDocx(["Unit 3 Quiz"]);

    expect(inspectDocxArchive(bytes).ok).toBe(true);
  });

  it("rejects a ZIP64 marker instead of trusting a 64-bit size", () => {
    const bytes = buildArchive([DOCUMENT_XML], { entryCount: 0xffff });

    expect(inspectDocxArchive(bytes)).toEqual({
      ok: false,
      error: "file_too_large",
    });
  });

  it("rejects an archive with too many entries", () => {
    const bytes = buildArchive([DOCUMENT_XML], {
      entryCount: IMPORT_DOCX_MAX_ENTRIES + 1,
    });

    expect(inspectDocxArchive(bytes)).toEqual({
      ok: false,
      error: "file_too_large",
    });
  });

  it("rejects an archive whose declared content exceeds the total cap", () => {
    const bytes = buildArchive([
      {
        ...DOCUMENT_XML,
        uncompressed: IMPORT_DOCX_MAX_UNCOMPRESSED_BYTES + 1,
      },
    ]);

    expect(inspectDocxArchive(bytes)).toEqual({
      ok: false,
      error: "file_too_large",
    });
  });

  it("rejects a suspicious compression ratio", () => {
    const bytes = buildArchive([
      {
        ...DOCUMENT_XML,
        compressed: 1_000,
        uncompressed: 20 * 1024 * 1024,
      },
    ]);

    expect(inspectDocxArchive(bytes)).toEqual({
      ok: false,
      error: "file_too_large",
    });
  });

  it("rejects a ZIP that is not a Word document", () => {
    const bytes = buildArchive([
      { name: "word/other.xml", compressed: 100, uncompressed: 1_000 },
    ]);

    expect(inspectDocxArchive(bytes)).toEqual({
      ok: false,
      error: "file_type_invalid",
    });
  });

  it("rejects truncated or corrupt input", () => {
    expect(inspectDocxArchive(new Uint8Array(10))).toEqual({
      ok: false,
      error: "file_type_invalid",
    });
    expect(inspectDocxArchive(new Uint8Array(64))).toEqual({
      ok: false,
      error: "file_type_invalid",
    });
  });
});
