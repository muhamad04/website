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
import { importErrorCopy, importsUi } from "@/lib/i18n/imports";
import type { ImportActionResult } from "@/lib/import/validation";
import { cn } from "@/lib/utils";

const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_TOTAL_BYTES = 8 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".docx", ".pdf", ".txt"];

function extensionAllowed(name: string): boolean {
  const lower = name.toLowerCase();
  return ALLOWED_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

export function ImportUploadForm({ grades }: { grades: GradeSummary[] }) {
  const router = useRouter();
  const [type, setType] = useState<AssessmentType>("quiz");
  const [gradeId, setGradeId] = useState(grades[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [questionFile, setQuestionFile] = useState<File | null>(null);
  const [answerFile, setAnswerFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

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

      if (file.size > MAX_FILE_BYTES) {
        setError("file_too_large");
        return;
      }
    }

    if ((questionFile.size ?? 0) + (answerFile?.size ?? 0) > MAX_TOTAL_BYTES) {
      setError("file_too_large");
      return;
    }

    const body = new FormData();
    body.set("grade_id", gradeId);
    body.set("type", type);
    body.set("title_en", title);
    body.set("questions", questionFile);

    if (answerFile) {
      body.set("answers", answerFile);
    }

    setPending(true);

    try {
      const response = await fetch("/teacher/assessments/import/upload", {
        method: "POST",
        body,
      });
      const result = (await response.json()) as ImportActionResult;

      if (!result.ok || !result.importId) {
        setError(result.error ?? "unknown");
        return;
      }

      router.push(`/teacher/assessments/import/${result.importId}`);
      router.refresh();
    } catch {
      setError("unknown");
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      {error ? (
        <Alert variant="error">
          <Bi
            en={importErrorCopy[error as keyof typeof importErrorCopy]?.en ?? importErrorCopy.unknown.en}
            ar={importErrorCopy[error as keyof typeof importErrorCopy]?.ar ?? importErrorCopy.unknown.ar}
          />
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
        </Field>
      </div>

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
          <Bi
            en={
              pending
                ? importsUi.upload.submitting.en
                : importsUi.upload.submit.en
            }
            ar={
              pending
                ? importsUi.upload.submitting.ar
                : importsUi.upload.submit.ar
            }
          />
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
