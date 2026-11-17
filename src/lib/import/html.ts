/**
 * A small, dependency-free HTML-to-text pass for mammoth's DOCX output.
 *
 * Word stores automatic numbering outside the paragraph text, so
 * `extractRawText` loses question and option numbers. Converting to HTML first
 * preserves `<ol>` lists; this walker turns them back into "1." lines and turns
 * table rows into "left | right" lines, which the question parser understands.
 */

const BLOCK_TAGS = new Set([
  "p",
  "div",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "blockquote",
  "pre",
  "section",
  "article",
]);

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  bull: "•",
  rsquo: "’",
  lsquo: "‘",
  ldquo: "“",
  rdquo: "”",
};

export function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      const code = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }

    if (entity.startsWith("#")) {
      const code = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }

    return ENTITIES[entity.toLowerCase()] ?? match;
  });
}

function cleanInline(value: string): string {
  return decodeHtmlEntities(value)
    .replace(/\u00a0/g, " ")
    .replace(/[\t ]+/g, " ")
    .replace(/\s+$/g, "")
    .replace(/^\s+/g, "");
}

type ListFrame = { ordered: boolean; index: number };

export function htmlToStructuredText(html: string): string {
  const lines: string[] = [];
  const lists: ListFrame[] = [];
  let buffer = "";
  let inCell = false;
  let cells: string[] = [];
  let inTable = false;

  const flushLine = () => {
    const value = buffer.replace(/[ \t]+/g, " ").trim();
    buffer = "";

    if (value) {
      lines.push(value);
    }
  };

  const flushRow = () => {
    const row = cells.map((cell) => cell.trim()).filter(Boolean);

    if (row.length > 0) {
      lines.push(row.join(" | "));
    }

    cells = [];
  };

  const tokens = html.match(/<[^>]+>|[^<]+/g) ?? [];

  for (const token of tokens) {
    if (!token.startsWith("<")) {
      buffer += token;
      continue;
    }

    const closing = token.startsWith("</");
    const match = token.match(/^<\/?\s*([a-z0-9]+)/i);
    const tag = (match?.[1] ?? "").toLowerCase();
    const selfClosing = /\/>$/.test(token);

    if (!tag) {
      continue;
    }

    if (tag === "table") {
      flushLine();
      inTable = !closing;
      if (closing) {
        flushRow();
      }
      continue;
    }

    if (inTable) {
      if (tag === "tr") {
        if (closing) {
          flushRow();
        } else {
          cells = [];
        }
        continue;
      }

      if (tag === "td" || tag === "th") {
        if (closing) {
          cells.push(cleanInline(buffer));
          buffer = "";
          inCell = false;
        } else {
          if (inCell) {
            cells.push(cleanInline(buffer));
          }
          buffer = "";
          inCell = true;
        }
        continue;
      }

      if (tag === "br") {
        cells.push(cleanInline(buffer));
        buffer = "";
        continue;
      }

      continue;
    }

    if (tag === "br") {
      flushLine();
      continue;
    }

    if (tag === "ol" || tag === "ul") {
      flushLine();

      if (closing) {
        lists.pop();
      } else {
        const startMatch = token.match(/start\s*=\s*["']?(\d+)/i);
        lists.push({
          ordered: tag === "ol",
          index: startMatch ? Number(startMatch[1]) : 1,
        });
      }
      continue;
    }

    if (tag === "li") {
      flushLine();

      if (closing) {
        continue;
      }

      const frame = lists[lists.length - 1];
      const indent = "  ".repeat(Math.max(0, lists.length - 1));
      const prefix = frame
        ? frame.ordered
          ? `${frame.index++}. `
          : "• "
        : "";

      buffer = `${indent}${prefix}`;
      continue;
    }

    if (BLOCK_TAGS.has(tag)) {
      flushLine();
      continue;
    }

    if (selfClosing) {
      continue;
    }
  }

  flushLine();

  return lines
    .map((line) => line.replace(/\u00a0/g, " ").trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
