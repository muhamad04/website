"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileText,
  Image as ImageIcon,
  MonitorPlay,
  UploadCloud,
} from "lucide-react";
import { Bi } from "@/components/bilingual";
import { FormField as Field } from "@/components/form-field";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  createResourceAction,
  prepareResourceUploadAction,
  updateResourceAction,
} from "@/app/(app)/teacher/resources/actions";
import type {
  GradeSummary,
  ResourceCategorySummary,
  ResourceRecord,
  ResourceType,
} from "@/lib/domain/types";
import {
  resourceErrorCopy,
  resourceTypeCopy,
  resourcesUi,
} from "@/lib/i18n/resources";
import {
  RESOURCE_MAX_FILE_BYTES,
  RESOURCE_MIME_TYPES,
  isAllowedMimeForType,
  type StoredResourceType,
} from "@/lib/resources/files";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type {
  FieldErrors,
  ResourceErrorCode,
} from "@/lib/validation/resources";

type Values = {
  type: ResourceType;
  title_en: string;
  title_ar: string;
  description_en: string;
  description_ar: string;
  grade_id: string;
  category_id: string;
  sort_order: string;
  is_published: boolean;
  youtube_url: string;
};

type Phase = "idle" | "preparing" | "uploading" | "saving";

function initialValues(
  resource: ResourceRecord | undefined,
  defaultGradeId: string | undefined,
  grades: GradeSummary[],
): Values {
  return {
    type: resource?.type ?? "pdf",
    title_en: resource?.title_en ?? "",
    title_ar: resource?.title_ar ?? "",
    description_en: resource?.description_en ?? "",
    description_ar: resource?.description_ar ?? "",
    grade_id: resource?.grade_id ?? defaultGradeId ?? grades[0]?.id ?? "",
    category_id: resource?.category_id ?? "",
    sort_order: String(resource?.sort_order ?? 0),
    is_published: resource?.is_published ?? false,
    youtube_url: resource?.external_url ?? "",
  };
}

const typeIcons: Record<ResourceType, typeof FileText> = {
  pdf: FileText,
  image: ImageIcon,
  youtube: MonitorPlay,
};

export function ResourceForm({
  mode,
  resource,
  grades,
  categories,
  defaultGradeId,
}: {
  mode: "create" | "edit";
  resource?: ResourceRecord;
  grades: GradeSummary[];
  categories: ResourceCategorySummary[];
  defaultGradeId?: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Values>(() =>
    initialValues(resource, defaultGradeId, grades),
  );
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<ResourceErrorCode | null>(null);
  const [success, setSuccess] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [pending, startTransition] = useTransition();

  const update = <K extends keyof Values>(key: K, value: Values[K]) => {
    setValues((previous) => ({ ...previous, [key]: value }));
  };

  const changeType = (type: ResourceType) => {
    setFile(null);
    setErrors({});
    setFormError(null);
    setValues((previous) => ({
      ...previous,
      type,
      youtube_url: type === "youtube" ? previous.youtube_url : "",
    }));
  };

  const validateFile = (candidate: File): ResourceErrorCode | null => {
    if (!isAllowedMimeForType(values.type as StoredResourceType, candidate.type)) {
      return "file_type_invalid";
    }

    if (candidate.size <= 0) {
      return "file_empty";
    }

    if (candidate.size > RESOURCE_MAX_FILE_BYTES) {
      return "file_too_large";
    }

    return null;
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    setSuccess(false);

    if (mode === "create" && values.type !== "youtube" && !file) {
      setErrors({ file: "file_required" });
      setFormError("file_required");
      return;
    }

    if (file) {
      const fileError = validateFile(file);

      if (fileError) {
        setErrors({ file: fileError });
        setFormError(fileError);
        return;
      }
    }

    const metadata = {
      type: values.type,
      title_en: values.title_en,
      // English-only authoring. On create the legacy Arabic column mirrors the
      // English title; on edit the existing Arabic value is sent back untouched.
      title_ar: mode === "create" ? values.title_en : values.title_ar,
      description_en: values.description_en,
      description_ar:
        mode === "create" ? values.description_en : values.description_ar,
      grade_id: values.grade_id,
      category_id: values.category_id,
      sort_order: values.sort_order,
      is_published: values.is_published,
    };

    startTransition(async () => {
      try {
        if (mode === "edit" && resource) {
          setPhase("saving");
          const outcome = await updateResourceAction({
            ...metadata,
            resource_id: resource.id,
            youtube_url:
              values.type === "youtube" ? values.youtube_url : undefined,
          });

          if (!outcome.ok) {
            setErrors(outcome.fieldErrors ?? {});
            setFormError(outcome.error ?? "unknown");
            return;
          }

          setSuccess(true);
          router.refresh();
          return;
        }

        if (values.type === "youtube") {
          setPhase("saving");
          const outcome = await createResourceAction({
            ...metadata,
            youtube_url: values.youtube_url,
          });

          if (!outcome.ok) {
            setErrors(outcome.fieldErrors ?? {});
            setFormError(outcome.error ?? "unknown");
            return;
          }

          router.push(`/teacher/resources/${outcome.resourceId ?? ""}?created=1`);
          return;
        }

        if (!file) {
          return;
        }

        setPhase("preparing");
        const prepared = await prepareResourceUploadAction({
          ...metadata,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
        });

        if (!prepared.ok || !prepared.upload) {
          setErrors(prepared.fieldErrors ?? {});
          setFormError(prepared.error ?? "upload_failed");
          return;
        }

        setPhase("uploading");
        const supabase = createBrowserClient();
        const { error: uploadError } = await supabase.storage
          .from(prepared.upload.bucket)
          .uploadToSignedUrl(prepared.upload.path, prepared.upload.token, file, {
            contentType: file.type,
            cacheControl: "3600",
          });

        if (uploadError) {
          console.error("resource upload failed", uploadError.message);
          setFormError("upload_failed");
          return;
        }

        setPhase("saving");
        const created = await createResourceAction({
          ...metadata,
          storage_path: prepared.upload.path,
        });

        if (!created.ok) {
          setErrors(created.fieldErrors ?? {});
          setFormError(created.error ?? "unknown");
          return;
        }

        router.push(`/teacher/resources/${created.resourceId ?? ""}?created=1`);
      } catch (error) {
        console.error(
          "resource form failed",
          error instanceof Error ? error.message : "unknown error",
        );
        setFormError("unknown");
      } finally {
        setPhase("idle");
      }
    });
  };

  const pendingLabel =
    phase === "preparing"
      ? resourcesUi.form.preparing
      : phase === "uploading"
        ? resourcesUi.form.uploading
        : phase === "saving"
          ? resourcesUi.form.savingResource
          : resourcesUi.actions.saving;

  const accept =
    values.type === "pdf"
      ? RESOURCE_MIME_TYPES.pdf.join(",")
      : RESOURCE_MIME_TYPES.image.join(",");

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      {formError ? (
        <Alert variant="error">
          <Bi en={resourceErrorCopy[formError].en} ar={resourceErrorCopy[formError].en} />
        </Alert>
      ) : null}

      {mode === "edit" && success ? (
        <Alert variant="success">
          <Bi
            en={resourcesUi.detail.updatedSuccess.en}
            ar={resourcesUi.detail.updatedSuccess.en}
          />
        </Alert>
      ) : null}

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-foreground">
          <Bi en={resourcesUi.form.type.en} ar={resourcesUi.form.type.en} />
        </legend>

        {mode === "create" ? (
          <div className="grid gap-2 sm:grid-cols-3">
            {(["pdf", "image", "youtube"] as const).map((type) => {
              const Icon = typeIcons[type];
              const copy = resourceTypeCopy[type];

              return (
                <label
                  key={type}
                  className={cn(
                    "flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-sm transition-colors",
                    values.type === type
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card hover:bg-secondary/40",
                  )}
                >
                  <input
                    type="radio"
                    name="resource_type"
                    value={type}
                    checked={values.type === type}
                    onChange={() => changeType(type)}
                    className="mt-0.5 size-4 accent-[var(--primary)]"
                  />
                  <span className="space-y-0.5">
                    <span className="flex items-center gap-1.5 font-medium text-foreground">
                      <Icon aria-hidden="true" className="size-4 text-primary" />
                      <Bi en={copy.en} ar={copy.en} hideSeparator />
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        ) : (
          <p className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm">
            <Bi
              en={resourceTypeCopy[values.type].en}
              ar={resourceTypeCopy[values.type].en}
            />
            <span className="mt-1 block text-xs text-muted-foreground">
              <Bi
                en={resourcesUi.form.typeHint.en}
                ar={resourcesUi.form.typeHint.en}
              />
            </span>
          </p>
        )}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="resource-title-en"
          label={resourcesUi.form.titleEn}
          error={errors.title_en}
          errorCopy={resourceErrorCopy}
        >
          <Input
            id="resource-title-en"
            value={values.title_en}
            onChange={(event) => update("title_en", event.target.value)}
            dir="ltr"
            aria-invalid={Boolean(errors.title_en)}
            required
          />
        </Field>

        <Field
          id="resource-description-en"
          label={resourcesUi.form.descriptionEn}
          error={errors.description_en}
          errorCopy={resourceErrorCopy}
        >
          <Textarea
            id="resource-description-en"
            value={values.description_en}
            onChange={(event) => update("description_en", event.target.value)}
            dir="ltr"
            rows={4}
          />
        </Field>

        <Field
          id="resource-grade"
          label={resourcesUi.form.grade}
          hint={resourcesUi.form.gradeHint}
          error={errors.grade_id}
          errorCopy={resourceErrorCopy}
        >
          <Select
            id="resource-grade"
            value={values.grade_id}
            onChange={(event) => update("grade_id", event.target.value)}
            aria-invalid={Boolean(errors.grade_id)}
            required
          >
            {grades.map((grade) => (
              <option key={grade.id} value={grade.id}>
                {grade.name_en}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          id="resource-category"
          label={resourcesUi.form.category}
          hint={resourcesUi.form.categoryHint}
          error={errors.category_id}
          errorCopy={resourceErrorCopy}
        >
          <Select
            id="resource-category"
            value={values.category_id}
            onChange={(event) => update("category_id", event.target.value)}
            aria-invalid={Boolean(errors.category_id)}
          >
            <option value="">{resourcesUi.form.noCategory.en}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name_en}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {values.type === "youtube" ? (
        <Field
          id="resource-youtube"
          label={resourcesUi.form.youtubeUrl}
          hint={resourcesUi.form.youtubeHint}
          error={errors.youtube_url}
          errorCopy={resourceErrorCopy}
        >
          <Input
            id="resource-youtube"
            value={values.youtube_url}
            onChange={(event) => update("youtube_url", event.target.value)}
            dir="ltr"
            placeholder="https://www.youtube.com/watch?v=..."
            aria-invalid={Boolean(errors.youtube_url)}
            required
          />
        </Field>
      ) : mode === "create" ? (
        <Field
          id="resource-file"
          label={resourcesUi.form.file}
          hint={resourcesUi.form.fileHint}
          error={errors.file ?? errors.storage_path}
          errorCopy={resourceErrorCopy}
        >
          <div className="space-y-2">
            <Input
              id="resource-file"
              type="file"
              accept={accept}
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setErrors((previous) => ({ ...previous, file: "" }));
              }}
              aria-invalid={Boolean(errors.file)}
              className="h-auto py-2 file:me-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-foreground"
            />
            <p className="text-xs text-muted-foreground">
              {file ? (
                <>
                  <UploadCloud aria-hidden="true" className="me-1 inline size-3.5" />
                  {file.name} · {(file.size / (1024 * 1024)).toFixed(2)} MB
                </>
              ) : (
                <Bi
                  en={resourcesUi.form.noFileChosen.en}
                  ar={resourcesUi.form.noFileChosen.en}
                />
              )}
            </p>
          </div>
        </Field>
      ) : (
        <div className="rounded-lg border border-border bg-secondary/40 p-3 text-sm">
          <p className="font-semibold text-foreground">
            <Bi
              en={resourcesUi.form.existingFile.en}
              ar={resourcesUi.form.existingFile.en}
            />
          </p>
          <p className="mt-1 break-all text-xs text-muted-foreground">
            {resource?.storage_path?.split("/").slice(-1)[0] ?? "—"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            <Bi
              en={resourcesUi.form.fileReplaceHint.en}
              ar={resourcesUi.form.fileReplaceHint.en}
            />
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="resource-order"
          label={resourcesUi.form.sortOrder}
          error={errors.sort_order}
          errorCopy={resourceErrorCopy}
        >
          <Input
            id="resource-order"
            type="number"
            min={0}
            max={999}
            value={values.sort_order}
            onChange={(event) => update("sort_order", event.target.value)}
            dir="ltr"
          />
        </Field>

        <div className="flex flex-col justify-end gap-1.5">
          <label className="flex items-start gap-2 rounded-lg border border-border bg-card p-3 text-sm">
            <input
              type="checkbox"
              checked={values.is_published}
              onChange={(event) =>
                update("is_published", event.target.checked)
              }
              className="mt-0.5 size-4 accent-[var(--primary)]"
            />
            <span className="space-y-0.5">
              <span className="font-semibold text-foreground">
                <Bi
                  en={resourcesUi.form.publish.en}
                  ar={resourcesUi.form.publish.en}
                />
              </span>
              <span className="block text-xs text-muted-foreground">
                <Bi
                  en={resourcesUi.form.publishHint.en}
                  ar={resourcesUi.form.publishHint.en}
                />
              </span>
            </span>
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? (
            <Bi en={pendingLabel.en} ar={pendingLabel.en} />
          ) : (
            <Bi
              en={
                mode === "create"
                  ? resourcesUi.actions.create.en
                  : resourcesUi.actions.save.en
              }
              ar={
                mode === "create"
                  ? resourcesUi.actions.create.en
                  : resourcesUi.actions.save.en
              }
            />
          )}
        </Button>
        <Link
          href="/teacher/resources"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          <Bi
            en={resourcesUi.actions.backToList.en}
            ar={resourcesUi.actions.backToList.en}
          />
        </Link>
      </div>
    </form>
  );
}
