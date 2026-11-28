"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { Bi } from "@/components/bilingual";
import { FormField as Field } from "@/components/form-field";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import {
  createCategoryAction,
  deleteCategoryAction,
  updateCategoryAction,
} from "@/app/(app)/teacher/resources/actions";
import type { ResourceCategoryWithCount } from "@/lib/domain/types";
import {
  resourceErrorCopy,
  resourcesUi,
} from "@/lib/i18n/resources";
import type {
  FieldErrors,
  ResourceErrorCode,
} from "@/lib/validation/resources";

type CategoryValues = {
  name_en: string;
  name_ar: string;
  slug: string;
  description_en: string;
  description_ar: string;
  sort_order: string;
  is_active: boolean;
};

const emptyValues: CategoryValues = {
  name_en: "",
  name_ar: "",
  slug: "",
  description_en: "",
  description_ar: "",
  sort_order: "0",
  is_active: true,
};

function valuesFrom(category: ResourceCategoryWithCount): CategoryValues {
  return {
    name_en: category.name_en,
    name_ar: category.name_ar,
    slug: category.slug,
    description_en: category.description_en ?? "",
    description_ar: category.description_ar ?? "",
    sort_order: String(category.sort_order),
    is_active: category.is_active,
  };
}

function CategoryFields({
  idPrefix,
  values,
  errors,
  update,
}: {
  idPrefix: string;
  values: CategoryValues;
  errors: FieldErrors;
  update: <K extends keyof CategoryValues>(
    key: K,
    value: CategoryValues[K],
  ) => void;
}) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          id={`${idPrefix}-name-en`}
          label={resourcesUi.categories.nameEn}
          error={errors.name_en}
          errorCopy={resourceErrorCopy}
        >
          <Input
            id={`${idPrefix}-name-en`}
            value={values.name_en}
            onChange={(event) => update("name_en", event.target.value)}
            dir="ltr"
            aria-invalid={Boolean(errors.name_en)}
            required
          />
        </Field>

        <Field
          id={`${idPrefix}-slug`}
          label={resourcesUi.categories.slug}
          hint={resourcesUi.categories.slugHint}
          error={errors.slug}
          errorCopy={resourceErrorCopy}
        >
          <Input
            id={`${idPrefix}-slug`}
            value={values.slug}
            onChange={(event) => update("slug", event.target.value)}
            dir="ltr"
            placeholder="grammar"
            aria-invalid={Boolean(errors.slug)}
          />
        </Field>

        <Field
          id={`${idPrefix}-order`}
          label={resourcesUi.categories.sortOrder}
          error={errors.sort_order}
          errorCopy={resourceErrorCopy}
        >
          <Input
            id={`${idPrefix}-order`}
            type="number"
            min={0}
            max={999}
            value={values.sort_order}
            onChange={(event) => update("sort_order", event.target.value)}
            dir="ltr"
          />
        </Field>

        <Field
          id={`${idPrefix}-description-en`}
          label={resourcesUi.categories.descriptionEn}
          error={errors.description_en}
          errorCopy={resourceErrorCopy}
        >
          <Textarea
            id={`${idPrefix}-description-en`}
            value={values.description_en}
            onChange={(event) =>
              update("description_en", event.target.value)
            }
            rows={3}
            dir="ltr"
          />
        </Field>

      </div>

      <label className="flex items-start gap-2 rounded-lg border border-border bg-card p-3 text-sm">
        <input
          type="checkbox"
          checked={values.is_active}
          onChange={(event) => update("is_active", event.target.checked)}
          className="mt-0.5 size-4 accent-[var(--primary)]"
        />
        <span className="space-y-0.5">
          <span className="font-semibold text-foreground">
            <Bi
              en={resourcesUi.categories.active.en}
              ar={resourcesUi.categories.active.en}
            />
          </span>
          <span className="block text-xs text-muted-foreground">
            <Bi
              en={resourcesUi.categories.activeHint.en}
              ar={resourcesUi.categories.activeHint.en}
            />
          </span>
        </span>
      </label>
    </>
  );
}

export function CategoryCreateForm() {
  const router = useRouter();
  const [values, setValues] = useState<CategoryValues>(emptyValues);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<ResourceErrorCode | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  const update = <K extends keyof CategoryValues>(
    key: K,
    value: CategoryValues[K],
  ) => {
    setValues((previous) => ({ ...previous, [key]: value }));
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrors({});
    setError(null);
    setSuccess(false);

    startTransition(async () => {
      const outcome = await createCategoryAction({
        ...values,
        // English-only authoring; mirror into the legacy Arabic columns.
        name_ar: values.name_en,
        description_ar: values.description_en,
      });

      if (!outcome.ok) {
        setErrors(outcome.fieldErrors ?? {});
        setError(outcome.error ?? "unknown");
        return;
      }

      setSuccess(true);
      setValues(emptyValues);
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {error ? (
        <Alert variant="error">
          <Bi en={resourceErrorCopy[error].en} ar={resourceErrorCopy[error].en} />
        </Alert>
      ) : null}
      {success ? (
        <Alert variant="success">
          <Bi
            en={resourcesUi.categories.created.en}
            ar={resourcesUi.categories.created.en}
          />
        </Alert>
      ) : null}

      <CategoryFields
        idPrefix="new-category"
        values={values}
        errors={errors}
        update={update}
      />

      <Button type="submit" size="sm" disabled={pending}>
        <Plus aria-hidden="true" className="size-3.5" />
        <Bi
          en={
            pending
              ? resourcesUi.actions.saving.en
              : resourcesUi.categories.create.en
          }
          ar={
            pending
              ? resourcesUi.actions.saving.en
              : resourcesUi.categories.create.en
          }
        />
      </Button>
    </form>
  );
}

export function CategoryRow({
  category,
}: {
  category: ResourceCategoryWithCount;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState(() => valuesFrom(category));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<ResourceErrorCode | null>(null);
  const [pending, startTransition] = useTransition();

  const update = <K extends keyof CategoryValues>(
    key: K,
    value: CategoryValues[K],
  ) => {
    setValues((previous) => ({ ...previous, [key]: value }));
  };

  const startEditing = () => {
    setValues(valuesFrom(category));
    setErrors({});
    setError(null);
    setEditing(true);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrors({});
    setError(null);

    startTransition(async () => {
      const outcome = await updateCategoryAction({
        ...values,
        category_id: category.id,
      });

      if (!outcome.ok) {
        setErrors(outcome.fieldErrors ?? {});
        setError(outcome.error ?? "unknown");
        return;
      }

      setEditing(false);
      router.refresh();
    });
  };

  const remove = () => {
    const confirmed = window.confirm(
      `${resourcesUi.categories.confirmDelete.en}\n${resourcesUi.categories.deleteWarning.en}`,
    );

    if (!confirmed) {
      return;
    }

    setError(null);

    startTransition(async () => {
      const outcome = await deleteCategoryAction({ category_id: category.id });

      if (!outcome.ok) {
        setError(outcome.error ?? "unknown");
        return;
      }

      router.refresh();
    });
  };

  return (
    <li className="rounded-xl border border-border bg-background/40 p-4">
      {editing ? (
        <form onSubmit={submit} className="space-y-4" noValidate>
          {error ? (
            <Alert variant="error">
              <Bi
                en={resourceErrorCopy[error].en}
                ar={resourceErrorCopy[error].en}
              />
            </Alert>
          ) : null}

          <CategoryFields
            idPrefix={`category-${category.id}`}
            values={values}
            errors={errors}
            update={update}
          />

          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              <Bi
                en={
                  pending
                    ? resourcesUi.actions.saving.en
                    : resourcesUi.categories.save.en
                }
                ar={
                  pending
                    ? resourcesUi.actions.saving.en
                    : resourcesUi.categories.save.en
                }
              />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => {
                setEditing(false);
                setErrors({});
                setError(null);
              }}
            >
              <X aria-hidden="true" className="size-3.5" />
              <Bi
                en={resourcesUi.categories.cancel.en}
                ar={resourcesUi.categories.cancel.en}
              />
            </Button>
          </div>
        </form>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {category.name_en}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline">{category.slug}</Badge>
              <Badge variant={category.is_active ? "success" : "muted"}>
                <Bi
                  en={
                    category.is_active
                      ? resourcesUi.categories.active.en
                      : resourcesUi.categories.inactive.en
                  }
                  ar={
                    category.is_active
                      ? resourcesUi.categories.active.en
                      : resourcesUi.categories.inactive.en
                  }
                  hideSeparator
                />
              </Badge>
              <Badge variant="default">
                <Bi
                  en={`${category.resourceCount} ${resourcesUi.categories.count.en}`}
                  ar={`${category.resourceCount} ${resourcesUi.categories.count.en}`}
                  hideSeparator
                />
              </Badge>
            </div>
          </div>

          {category.description_en ? (
            <div className="space-y-1 text-xs text-muted-foreground">
              <p>{category.description_en}</p>
            </div>
          ) : null}

          {error ? (
            <Alert variant="error">
              <Bi
                en={resourceErrorCopy[error].en}
                ar={resourceErrorCopy[error].en}
              />
            </Alert>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={startEditing}
            >
              <Pencil aria-hidden="true" className="size-3.5" />
              <Bi
                en={resourcesUi.categories.edit.en}
                ar={resourcesUi.categories.edit.en}
              />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={pending}
              onClick={remove}
            >
              <Trash2 aria-hidden="true" className="size-3.5" />
              <Bi
                en={
                  pending
                    ? resourcesUi.actions.deleting.en
                    : resourcesUi.categories.delete.en
                }
                ar={
                  pending
                    ? resourcesUi.actions.deleting.en
                    : resourcesUi.categories.delete.en
                }
              />
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
