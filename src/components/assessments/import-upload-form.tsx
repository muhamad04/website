"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileUp, ShieldCheck } from "lucide-react";
import { Bi } from "@/components/bilingual";
import { FormField as Field } from "@/components/form-field";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { AssessmentType, GradeSummary } from "@/lib/domain/types";
import {
  assessmentErrorCopy,
  assessmentTypeCopy,
  assessmentsUi,
} from "@/lib/i18n/assessments";
import {
  formatImportBytes,
  importErrorCopy,
  importFileTooLargeCopy,
  importTotalTooLargeCopy,
  importsUi,
} from "@/lib/i18n/imports";
import type {
  ImportActionResult,
  ImportUploadInitResult,
} from "@/lib/import/validation";
import { cn } from "@/lib/utils";

const ALLOWED_EXTENSIONS = [".docx", ".pdf", ".txt"];

const MIME_BY_EXTENSION: Record<string, string> = {
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".pdf": "application/pdf",
  ".txt": "text/plain",
};

type Phase = "idle" | "preparing" | "uploading" | "processing";

function extensionAllowed(name: string): boolean {
  const lower = name.toLowerCase();
  return ALLOWED_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

/**
 * Some browsers report an empty `File.type` for `.txt`. Fall back to the
 * extension so the server's extension/MIME agreement check still runs; the
 * finalize step verifies magic bytes regardless.
 */
function declaredMimeType(file: File): string {
  if (file.type) {
    return file.type;
  }

  const lower = file.name.toLowerCase();
  const extension = ALLOWED_EXTENSIONS.find((candidate) =>
    lower.endsWith(candidate),
  );

  return extension ? MIME_BY_EXTENSION[extension] : "application/octet-stream";
}

function putToSignedUrl(
  signedUrl: string,
  file: File,
  contentType: string,
  onProgress: (loaded: number, total: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", signedUrl);
    request.setRequestHeader("content-type", contentType);
    request.setRequestHeader("x-upsert", "false");
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(event.loaded, event.total);
      }
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        resolve();
        return;
      }

      reject(new Error(`upload_${request.status}`));
    };
    request.onerror = () => reject(new Error("upload_failed"));
    request.onabort = () => reject(new Error("upload_failed"));
    request.send(file);
  });
}

async function readJson<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    return { ok: false, error: "unknown" } as T;
  }
}

export function ImportUploadForm({
  grades,
  maxBytes,
  maxTotalBytes,
}: {
  grades: GradeSummary[];
  maxBytes: number;
  maxTotalBytes: number;
}) {
  const router = useRouter();
  const [type, setType] = useState<AssessmentType>("quiz");
  const [gradeId, setGradeId] = useState(grades[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [questionFile, setQuestionFile] = useState<File | null>(null);
  const [answerFile, setAnswerFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState<Record<"questions" | "answers", number>>(
    { questions: 0, answers: 0 },
  );

  const pending = phase !== "idle";

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!questionFile) {
      setError("file_required");
      return;
    }

    for (const file of [questionFile, answerFile]) {
      if (!file) {
        continue;
      }

      if (!extensionAllowed(file.name)) {
        setError("file_type_invalid");
        return;
      }

      if (file.size > maxBytes) {
        setError("file_too_large");
        return;
      }
    }

    if (questionFile.size + (answerFile?.size ?? 0) > maxTotalBytes) {
      setError("file_total_too_large");
      return;
    }

    const descriptors = [
      {
        role: "questions" as const,
        name: questionFile.name,
        size: questionFile.size,
        type: declaredMimeType(questionFile),
      },
      ...(answerFile
        ? [
            {
              role: "answers" as const,
              name: answerFile.name,
              size: answerFile.size,
              type: declaredMimeType(answerFile),
            },
          ]
        : []),
    ];

    setPhase("preparing");
    setProgress({ questions: 0, answers: 0 });

    let importId: string | null = null;
    let finalizeStarted = false;

    try {
      const initResponse = await fetch(
        "/teacher/assessments/import/upload/init",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            grade_id: gradeId,
            type,
            title_en: title,
            files: descriptors,
          }),
        },
      );
      const init = await readJson<ImportUploadInitResult>(initResponse);

      if (!init.ok || !init.importId || !init.uploads) {
        setError(init.error ?? "unknown");
        setPhase("idle");
        return;
      }

      importId = init.importId;
      setPhase("uploading");

      for (const upload of init.uploads) {
        const file = upload.role === "questions" ? questionFile : answerFile;

        if (!file) {
          continue;
        }

        await putToSignedUrl(
          upload.signedUrl,
          file,
          declaredMimeType(file),
          (loaded, total) => {
            setProgress((previous) => ({
              ...previous,
              [upload.role]: total > 0 ? Math.round((loaded / total) * 100) : 0,
            }));
          },
        );

        setProgress((previous) => ({ ...previous, [upload.role]: 100 }));
      }

      setPhase("processing");
      finalizeStarted = true;

      const finalResponse = await fetch(
        "/teacher/assessments/import/upload/finalize",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            import_id: importId,
            grade_id: gradeId,
            type,
            title_en: title,
            files: descriptors,
          }),
        },
      );
      const final = await readJson<ImportActionResult>(finalResponse);

      if (!final.ok || !final.importId) {
        setError(final.error ?? "unknown");
        setPhase("idle");
        return;
      }

      router.push(`/teacher/assessments/import/${final.importId}`);
      router.refresh();
    } catch {
      if (importId && !finalizeStarted) {
        await fetch("/teacher/assessments/import/upload/abort", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ import_id: importId }),
        }).catch(() => undefined);
      }

      setError("upload_failed");
      setPhase("idle");
    }
  };

  const errorCopy =
    error === "file_too_large"
      ? importFileTooLargeCopy(maxBytes)
      : error === "file_total_too_large"
        ? importTotalTooLargeCopy(maxTotalBytes)
        : (importErrorCopy[error as keyof typeof importErrorCopy] ??
          importErrorCopy.unknown);

  const phaseCopy =
    phase === "preparing"
      ? importsUi.upload.preparing
      : phase === "uploading"
        ? importsUi.upload.uploading
        : phase === "processing"
          ? importsUi.upload.processing
          : importsUi.upload.submit;

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      {error ? (
        <Alert variant="error">
          <Bi en={errorCopy.en} ar={errorCopy.ar} />
        </Alert>
      ) : null}

      <div className="grid gap-5 rounded-xl border border-border bg-card p-5 shadow-xs sm:grid-cols-2">
        <Field
          id="grade_id"
          label={importsUi.upload.grade}
          hint={importsUi.upload.gradeHint}
          errorCopy={assessmentErrorCopy}
        >
          <Select
            id="grade_id"
            value={gradeId}
            disabled={pending || grades.length === 0}
            onChange={(event) => setGradeId(event.target.value)}
          >
            {grades.map((grade) => (
              <option key={grade.id} value={grade.id}>
                {grade.name_en} · {grade.name_ar}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          id="type"
          label={importsUi.upload.type}
          errorCopy={assessmentErrorCopy}
        >
          <Select
            id="type"
            value={type}
            disabled={pending}
            onChange={(event) => setType(event.target.value as AssessmentType)}
          >
            {(Object.keys(assessmentTypeCopy) as AssessmentType[]).map(
              (value) => (
                <option key={value} value={value}>
                  {assessmentTypeCopy[value].en} · {assessmentTypeCopy[value].ar}
                </option>
              ),
            )}
          </Select>
        </Field>

        <Field
          id="title_en"
          label={importsUi.upload.titleOverride}
          hint={importsUi.upload.titleOverrideHint}
          errorCopy={assessmentErrorCopy}
          className="sm:col-span-2"
        >
          <Input
            id="title_en"
            value={title}
            maxLength={200}
            disabled={pending}
            onChange={(event) => setTitle(event.target.value)}
          />
        </Field>
      </div>

      <div className="grid gap-5 rounded-xl border border-border bg-card p-5 shadow-xs sm:grid-cols-2">
        <Field
          id="questions"
          label={importsUi.upload.questionFile}
          hint={importsUi.upload.questionFileHint}
          errorCopy={assessmentErrorCopy}
        >
          <Input
            id="questions"
            type="file"
            accept=".docx,.pdf,.txt,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            disabled={pending}
            onChange={(event) =>
              setQuestionFile(event.target.files?.[0] ?? null)
            }
          />
          {questionFile ? (
            <p className="mt-1 text-xs text-muted-foreground">
              <Bi
                en={importsUi.upload.selectedSize.en}
                ar={importsUi.upload.selectedSize.ar}
              />{" "}
              {formatImportBytes(questionFile.size)}
            </p>
          ) : null}
        </Field>

        <Field
          id="answers"
          label={importsUi.upload.answerFile}
          hint={importsUi.upload.answerFileHint}
          errorCopy={assessmentErrorCopy}
        >
          <Input
            id="answers"
            type="file"
            accept=".docx,.pdf,.txt,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            disabled={pending}
            onChange={(event) => setAnswerFile(event.target.files?.[0] ?? null)}
          />
          {answerFile ? (
            <p className="mt-1 text-xs text-muted-foreground">
              <Bi
                en={importsUi.upload.selectedSize.en}
                ar={importsUi.upload.selectedSize.ar}
              />{" "}
              {formatImportBytes(answerFile.size)}
            </p>
          ) : null}
        </Field>
      </div>

      {pending ? (
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-semibold">
            <Bi en={phaseCopy.en} ar={phaseCopy.ar} />
          </p>
          {phase === "uploading" || phase === "processing" ? (
            <div className="space-y-2">
              {questionFile ? (
                <ProgressRow
                  label={importsUi.upload.questionFile}
                  percent={progress.questions}
                />
              ) : null}
              {answerFile ? (
                <ProgressRow
                  label={importsUi.upload.answerFile}
                  percent={progress.answers}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <Alert variant="info">
        <div className="space-y-2">
          <p className="flex items-center gap-2 font-semibold">
            <ShieldCheck aria-hidden="true" className="size-4" />
            <Bi
              en={importsUi.upload.localOnly.en}
              ar={importsUi.upload.localOnly.ar}
            />
          </p>
          <p>
            <Bi
              en={importsUi.upload.limits.en}
              ar={importsUi.upload.limits.ar}
            />
          </p>
          <p className="text-sm">
            <span className="font-semibold">
              <Bi
                en={importsUi.upload.maxFile.en}
                ar={importsUi.upload.maxFile.ar}
              />
              :{" "}
            </span>
            {formatImportBytes(maxBytes)} ·{" "}
            <span className="font-semibold">
              <Bi
                en={importsUi.upload.totalMax.en}
                ar={importsUi.upload.totalMax.ar}
              />
              :{" "}
            </span>
            {formatImportBytes(maxTotalBytes)}
          </p>
          <p>
            <Bi
              en={importsUi.upload.privacy.en}
              ar={importsUi.upload.privacy.ar}
            />
          </p>
          <p>
            <Bi
              en={importsUi.upload.reviewRequired.en}
              ar={importsUi.upload.reviewRequired.ar}
            />
          </p>
        </div>
      </Alert>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending || grades.length === 0}>
          <FileUp aria-hidden="true" />
          <Bi en={phaseCopy.en} ar={phaseCopy.ar} />
        </Button>
        <Link
          href="/teacher/assessments"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          <Bi
            en={assessmentsUi.actions.backToList.en}
            ar={assessmentsUi.actions.backToList.ar}
          />
        </Link>
      </div>

      {grades.length === 0 ? (
        <Alert variant="error">
          <Bi
            en={assessmentsUi.messages.noGrades.en}
            ar={assessmentsUi.messages.noGrades.ar}
          />
        </Alert>
      ) : null}
    </form>
  );
}

function ProgressRow({
  label,
  percent,
}: {
  label: { en: string; ar: string };
  percent: number;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <Bi en={label.en} ar={label.ar} />
        <span>{percent}%</span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-secondary"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
