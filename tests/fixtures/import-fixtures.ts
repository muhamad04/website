import JSZip from "jszip";

/**
 * Deterministic fixtures for the assessment importer tests. The DOCX is built
 * with JSZip and the PDF is assembled with real byte offsets, so both are
 * genuine files that mammoth and PDF.js parse without any network access.
 */

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function docxParagraph(value: string): string {
  return `<w:p><w:r><w:t xml:space="preserve">${escapeXml(value)}</w:t></w:r></w:p>`;
}

export async function buildDocx(paragraphs: string[]): Promise<Uint8Array> {
  const zip = new JSZip();

  zip.file("[Content_Types].xml", CONTENT_TYPES);
  zip.file("_rels/.rels", ROOT_RELS);
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphs.map(docxParagraph).join("\n    ")}
  </w:body>
</w:document>`,
  );

  return zip.generateAsync({ type: "uint8array" });
}

function escapePdfText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

/**
 * Builds a minimal but structurally valid text PDF with correct xref offsets.
 * PDF.js reads it as ordinary text, which is exactly what the importer
 * supports (image-only PDFs are deliberately rejected).
 */
export function buildTextPdf(lines: string[]): Uint8Array {
  const content = lines
    .map((line, index) => {
      const y = 760 - index * 18;
      return `BT /F1 12 Tf 72 ${y} Td (${escapePdfText(line)}) Tj ET`;
    })
    .join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];

  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefStart = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";

  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefStart}\n%%EOF\n`;

  return new Uint8Array(Buffer.from(pdf, "latin1"));
}

export function buildTextFile(text: string): Uint8Array {
  return new Uint8Array(Buffer.from(text, "utf-8"));
}

export const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * "Conditionals_Quiz" fixtures. The original files were not present in the
 * repository, so these deterministic DOCX files reproduce the same shape:
 * 10 four-option MCQs, 1 mark each, plus a separate answer key.
 */

export const CONDITIONALS_QUIZ_FILE_NAME = "Conditionals_Quiz.docx";
export const CONDITIONALS_ANSWER_FILE_NAME =
  "Conditionals_Quiz_Answer_Key.docx";

export type ConditionalsQuestionFixture = {
  number: string;
  prompt: string;
  options: [string, string, string, string];
  correctIndex: number;
};

export const CONDITIONALS_QUESTIONS: ConditionalsQuestionFixture[] = [
  {
    number: "1",
    prompt: "If it rains tomorrow, we ______ at home.",
    options: ["will stay", "stayed", "would stay", "staying"],
    correctIndex: 0,
  },
  {
    number: "2",
    prompt: "If I ______ more time, I would learn the guitar.",
    options: ["have", "had", "will have", "would have"],
    correctIndex: 1,
  },
  {
    number: "3",
    prompt: "If she had studied harder, she ______ the exam.",
    options: ["passes", "passed", "would have passed", "will pass"],
    correctIndex: 2,
  },
  {
    number: "4",
    prompt: "Unless you hurry, you ______ the bus.",
    options: ["will miss", "missed", "would miss", "have missed"],
    correctIndex: 0,
  },
  {
    number: "5",
    prompt: "If I were you, I ______ that job.",
    options: ["took", "will take", "have taken", "would take"],
    correctIndex: 3,
  },
  {
    number: "6",
    prompt: "If they ______ earlier, they would have caught the train.",
    options: ["leave", "had left", "would leave", "have left"],
    correctIndex: 1,
  },
  {
    number: "7",
    prompt: "We will go for a walk if the weather ______ nice.",
    options: ["will be", "were", "is", "would be"],
    correctIndex: 2,
  },
  {
    number: "8",
    prompt: "If he ______ the truth, he would tell us.",
    options: ["knew", "knows", "will know", "had known"],
    correctIndex: 0,
  },
  {
    number: "9",
    prompt: "I would have called you if I ______ your number.",
    options: ["have", "had", "will have", "had had"],
    correctIndex: 3,
  },
  {
    number: "10",
    prompt: "If you heat ice, it ______.",
    options: ["melted", "melts", "would melt", "will melt"],
    correctIndex: 1,
  },
];

export async function buildConditionalsQuizDocx(): Promise<Uint8Array> {
  const paragraphs: string[] = [
    "Conditionals Quiz",
    "Name: ____________________",
    "Class: ____________________",
    "Date: ____________________",
    "Time: 20 minutes",
    "Instructions: Choose the correct answer for each question. (10 marks)",
    "",
    "Section A: Multiple choice",
  ];

  for (const question of CONDITIONALS_QUESTIONS) {
    paragraphs.push(`${question.number}. ${question.prompt} (1 mark)`);

    question.options.forEach((text, index) => {
      paragraphs.push(`${String.fromCharCode(65 + index)}. ${text}`);
    });

    paragraphs.push("");
  }

  return buildDocx(paragraphs);
}

export async function buildConditionalsAnswerKeyDocx(): Promise<Uint8Array> {
  const paragraphs: string[] = ["Conditionals Quiz — Answer Key", ""];

  for (const [index, question] of CONDITIONALS_QUESTIONS.entries()) {
    const letter = String.fromCharCode(65 + question.correctIndex);
    const text = question.options[question.correctIndex];

    // Mix letter-only and letter+text keys. Both must match without warnings.
    paragraphs.push(
      index % 2 === 0
        ? `${question.number}. ${letter}. ${text}`
        : `${question.number}. ${letter}`,
    );
  }

  return buildDocx(paragraphs);
}
