"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Bi } from "@/components/bilingual";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import {
  createSectionAction,
  deleteQuestionAction,
  deleteSectionAction,
  reorderQuestionsAction,
  reorderSectionsAction,
  updateSectionAction,
} from "@/app/(app)/teacher/assessments/actions";
import type { QuestionType } from "@/lib/domain/types";
import {
  assessmentErrorCopy,
  assessmentsUi,
  questionTypeCopy,
} from "@/lib/i18n/assessments";
import { cn } from "@/lib/utils";
import type { AssessmentErrorCode } from "@/lib/validation/assessments";

type SectionView = {
  id: string;
  title_en: string;
  instructions_en: string | null;
  position: number;
  questions: Array<{
    id: string;
    type: QuestionType;
    prompt_en: string;
    marks: number;
    position: number;
  }>;
};

export function SectionManager({
  assessmentId,
  sections,
}: {
  assessmentId: string;
  sections: SectionView[];
}) {
  const router = useRouter();
  const [error, setError] = useState<AssessmentErrorCode | null>(null);
  const [pending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(sections.length === 0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    title_en: "",
    instructions_en: "",
  });
  const [createDraft, setCreateDraft] = useState({
    title_en: "",
    instructions_en: "",
  });

  const run = (action: () => Promise<{ ok: boolean; error?: AssessmentErrorCode }>) => {
    setError(null);

    startTransition(async () => {
      const outcome = await action();

      if (!outcome.ok) {
        setError(outcome.error ?? "unknown");
        return;
      }

      router.refresh();
    });
  };

  const reorderSections = (index: number, direction: -1 | 1) => {
    const target = index + direction;

    if (target < 0 || target >= sections.length) {
      return;
    }

    const ids = sections.map((section) => section.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];

    run(() =>
      reorderSectionsAction({ assessment_id: assessmentId, section_ids: ids }),
    );
  };

  const reorderQuestions = (
    section: SectionView,
    index: number,
    direction: -1 | 1,
  ) => {
    const target = index + direction;

    if (target < 0 || target >= section.questions.length) {
      return;
    }

    const ids = section.questions.map((question) => question.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];

    run(() => reorderQuestionsAction({ section_id: section.id, question_ids: ids }));
  };

  const createSection = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    run(async () => {
      const outcome = await createSectionAction({
        assessment_id: assessmentId,
        ...createDraft,
      });

      if (outcome.ok) {
        setCreateDraft({
          title_en: "",
          instructions_en: "",
        });
        setShowCreate(false);
      }

      return outcome;
    });
  };

  const startEditing = (section: SectionView) => {
    setEditingId(section.id);
    setDraft({
      title_en: section.title_en,
      instructions_en: section.instructions_en ?? "",
    });
  };

  const saveSection = (sectionId: string) => {
    run(async () => {
      const outcome = await updateSectionAction({ section_id: sectionId, ...draft });

      if (outcome.ok) {
        setEditingId(null);
      }

      return outcome;
    });
  };

  return (
    <div className="space-y-4">
      {error ? (
        <Alert variant="error">
          <Bi en={assessmentErrorCopy[error].en} ar={assessmentErrorCopy[error].ar} />
        </Alert>
      ) : null}

      {sections.length === 0 && !showCreate ? (
        <div className="rounded-xl border border-dashed border-border bg-card/60 px-5 py-8 text-center">
          <p className="text-sm font-semibold text-foreground">
            <Bi
              en={assessmentsUi.builder.emptySections.en}
              ar={assessmentsUi.builder.emptySections.ar}
            />
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            <Bi
              en={assessmentsUi.builder.emptySectionsHint.en}
              ar={assessmentsUi.builder.emptySectionsHint.ar}
            />
          </p>
        </div>
      ) : null}

      <ol className="space-y-4">
        {sections.map((section, sectionIndex) => (
          <li
            key={section.id}
            className="rounded-xl border border-border bg-card p-4 shadow-xs sm:p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                {editingId === section.id ? (
                  <div className="space-y-2">
                    <div className="space-y-2">
                      <Input
                        value={draft.title_en}
                        aria-label={assessmentsUi.builder.sectionTitle.en}
                        onChange={(event) =>
                          setDraft((previous) => ({
                            ...previous,
                            title_en: event.target.value,
                          }))
                        }
                      />
                      <Textarea
                        value={draft.instructions_en}
                        aria-label={assessmentsUi.builder.sectionInstructions.en}
                        onChange={(event) =>
                          setDraft((previous) => ({
                            ...previous,
                            instructions_en: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={pending}
                        onClick={() => saveSection(section.id)}
                      >
                        <Check aria-hidden="true" className="size-3.5" />
                        <Bi
                          en={assessmentsUi.actions.saveSection.en}
                          ar={assessmentsUi.actions.saveSection.ar}
                        />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingId(null)}
                      >
                        <X aria-hidden="true" className="size-3.5" />
                        <Bi
                          en={assessmentsUi.actions.cancel.en}
                          ar={assessmentsUi.actions.cancel.ar}
                        />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold text-foreground">
                        {section.title_en}
                      </h3>
                      <Badge variant="muted">
                        <Bi
                          en={`${section.questions.length} ${assessmentsUi.builder.questions.en}`}
                          ar={`${section.questions.length} ${assessmentsUi.builder.questions.ar}`}
                        />
                      </Badge>
                    </div>
                    {section.instructions_en ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {section.instructions_en}
                      </p>
                    ) : null}
                  </div>
                )}
              </div>

              {editingId === section.id ? null : (
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label={assessmentsUi.actions.moveUp.en}
                    disabled={pending || sectionIndex === 0}
                    onClick={() => reorderSections(sectionIndex, -1)}
                  >
                    <ArrowUp aria-hidden="true" className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label={assessmentsUi.actions.moveDown.en}
                    disabled={pending || sectionIndex === sections.length - 1}
                    onClick={() => reorderSections(sectionIndex, 1)}
                  >
                    <ArrowDown aria-hidden="true" className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => startEditing(section)}
                  >
                    <Pencil aria-hidden="true" className="size-3.5" />
                    <Bi
                      en={assessmentsUi.actions.edit.en}
                      ar={assessmentsUi.actions.edit.ar}
                    />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={pending}
                    onClick={() => {
                      if (
                        !window.confirm(
                          `${assessmentsUi.builder.confirmDeleteSection.en}\n${assessmentsUi.builder.confirmDeleteSection.ar}`,
                        )
                      ) {
                        return;
                      }

                      run(() => deleteSectionAction({ section_id: section.id }));
                    }}
                  >
                    <Trash2 aria-hidden="true" className="size-3.5" />
                  </Button>
                </div>
              )}
            </div>

            {section.questions.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                <Bi
                  en={assessmentsUi.builder.noQuestions.en}
                  ar={assessmentsUi.builder.noQuestions.ar}
                />
              </p>
            ) : (
              <ol className="mt-3 space-y-2">
                {section.questions.map((question, questionIndex) => (
                  <li
                    key={question.id}
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-border/70 bg-background/60 p-3"
                  >
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">
                      {questionIndex + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {question.prompt_en}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        <span>
                          <Bi
                            en={questionTypeCopy[question.type].en}
                            ar={questionTypeCopy[question.type].ar}
                          />
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          <Bi
                            en={`${question.marks} ${assessmentsUi.builder.questionMarks.en}`}
                            ar={`${question.marks} ${assessmentsUi.builder.questionMarks.ar}`}
                          />
                        </span>
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        aria-label={assessmentsUi.actions.moveUp.en}
                        disabled={pending || questionIndex === 0}
                        onClick={() =>
                          reorderQuestions(section, questionIndex, -1)
                        }
                      >
                        <ArrowUp aria-hidden="true" className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        aria-label={assessmentsUi.actions.moveDown.en}
                        disabled={
                          pending ||
                          questionIndex === section.questions.length - 1
                        }
                        onClick={() =>
                          reorderQuestions(section, questionIndex, 1)
                        }
                      >
                        <ArrowDown aria-hidden="true" className="size-3.5" />
                      </Button>
                      <Link
                        href={`/teacher/assessments/${assessmentId}/questions/${question.id}`}
                        className={cn(
                          buttonVariants({ variant: "outline", size: "sm" }),
                        )}
                      >
                        <Pencil aria-hidden="true" className="size-3.5" />
                        <Bi
                          en={assessmentsUi.actions.editQuestion.en}
                          ar={assessmentsUi.actions.editQuestion.ar}
                        />
                      </Link>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        disabled={pending}
                        onClick={() => {
                          if (
                            !window.confirm(
                              `${assessmentsUi.builder.confirmDeleteQuestion.en}\n${assessmentsUi.builder.confirmDeleteQuestion.ar}`,
                            )
                          ) {
                            return;
                          }

                          run(() =>
                            deleteQuestionAction({ question_id: question.id }),
                          );
                        }}
                      >
                        <Trash2 aria-hidden="true" className="size-3.5" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ol>
            )}

            <div className="mt-3">
              <Link
                href={`/teacher/assessments/${assessmentId}/questions/new?section_id=${section.id}`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                <Plus aria-hidden="true" className="size-3.5" />
                <Bi
                  en={assessmentsUi.actions.addQuestion.en}
                  ar={assessmentsUi.actions.addQuestion.ar}
                />
              </Link>
            </div>
          </li>
        ))}
      </ol>

      {showCreate ? (
        <form
          onSubmit={createSection}
          className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-xs sm:p-5"
        >
          <div className="space-y-3">
            <Input
              placeholder={assessmentsUi.builder.sectionTitle.en}
              value={createDraft.title_en}
              onChange={(event) =>
                setCreateDraft((previous) => ({
                  ...previous,
                  title_en: event.target.value,
                }))
              }
            />
            <Textarea
              placeholder={assessmentsUi.builder.sectionInstructions.en}
              value={createDraft.instructions_en}
              onChange={(event) =>
                setCreateDraft((previous) => ({
                  ...previous,
                  instructions_en: event.target.value,
                }))
              }
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              <Plus aria-hidden="true" className="size-3.5" />
              <Bi
                en={assessmentsUi.actions.addSection.en}
                ar={assessmentsUi.actions.addSection.ar}
              />
            </Button>
            {sections.length > 0 ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setShowCreate(false)}
              >
                <Bi
                  en={assessmentsUi.actions.cancel.en}
                  ar={assessmentsUi.actions.cancel.ar}
                />
              </Button>
            ) : null}
          </div>
        </form>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowCreate(true)}
        >
          <Plus aria-hidden="true" className="size-4" />
          <Bi
            en={assessmentsUi.actions.addSection.en}
            ar={assessmentsUi.actions.addSection.ar}
          />
        </Button>
      )}
    </div>
  );
}
