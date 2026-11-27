"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowRightLeft,
  ArrowUp,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  MessagesSquare,
  Pencil,
  PenLine,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Bi } from "@/components/bilingual";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  createSectionAction,
  deleteQuestionAction,
  deleteSectionAction,
  moveQuestionAction,
  reorderQuestionsAction,
  reorderSectionsAction,
  updateSectionAction,
} from "@/app/(app)/teacher/assessments/actions";
import type { DialogueLine, QuestionType, SectionKind } from "@/lib/domain/types";
import {
  assessmentErrorCopy,
  assessmentsUi,
  questionTypeCopy,
} from "@/lib/i18n/assessments";
import { cn } from "@/lib/utils";
import type { AssessmentErrorCode } from "@/lib/validation/assessments";

type SectionView = {
  id: string;
  kind: SectionKind;
  title_en: string;
  instructions_en: string | null;
  passage_en: string | null;
  vocabulary_en: string | null;
  source_en: string | null;
  dialogue_lines: DialogueLine[];
  position: number;
  questions: Array<{
    id: string;
    type: QuestionType;
    prompt_en: string;
    marks: number;
    position: number;
  }>;
};

type SectionDraft = {
  kind: SectionKind;
  title_en: string;
  instructions_en: string;
  passage_en: string;
  vocabulary_en: string;
  source_en: string;
  dialogue_lines: DialogueLine[];
};

function emptyDraft(kind: SectionKind = "standard"): SectionDraft {
  return {
    kind,
    title_en: "",
    instructions_en: "",
    passage_en: "",
    vocabulary_en: "",
    source_en: "",
    dialogue_lines: kind === "dialogue" ? [{ speaker: "", text: "" }] : [],
  };
}

function draftFromSection(section: SectionView): SectionDraft {
  return {
    kind: section.kind,
    title_en: section.title_en,
    instructions_en: section.instructions_en ?? "",
    passage_en: section.passage_en ?? "",
    vocabulary_en: section.vocabulary_en ?? "",
    source_en: section.source_en ?? "",
    dialogue_lines:
      section.dialogue_lines.length > 0
        ? section.dialogue_lines.map((line) => ({ ...line }))
        : [{ speaker: "", text: "" }],
  };
}

function kindLabel(kind: SectionKind) {
  if (kind === "reading_passage") {
    return assessmentsUi.builder.kindReadingPassage;
  }

  if (kind === "dialogue") {
    return assessmentsUi.builder.kindDialogue;
  }

  return assessmentsUi.builder.kindStandard;
}

function SectionKindBadge({ kind }: { kind: SectionKind }) {
  if (kind === "reading_passage") {
    return (
      <Badge variant="outline">
        <BookOpen aria-hidden="true" className="size-3" />
        <Bi
          en={assessmentsUi.builder.kindReadingPassage.en}
          ar={assessmentsUi.builder.kindReadingPassage.ar}
        />
      </Badge>
    );
  }

  if (kind === "dialogue") {
    return (
      <Badge variant="outline">
        <MessagesSquare aria-hidden="true" className="size-3" />
        <Bi
          en={assessmentsUi.builder.kindDialogue.en}
          ar={assessmentsUi.builder.kindDialogue.ar}
        />
      </Badge>
    );
  }

  return null;
}

function DialogueEditor({
  lines,
  disabled,
  onChange,
}: {
  lines: DialogueLine[];
  disabled: boolean;
  onChange: (lines: DialogueLine[]) => void;
}) {
  const update = (index: number, patch: Partial<DialogueLine>) => {
    onChange(
      lines.map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...patch } : line,
      ),
    );
  };

  return (
    <div className="space-y-2">
      {lines.map((line, index) => (
        <div
          key={index}
          className="grid gap-2 rounded-lg border border-border/70 bg-background/60 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] sm:items-center"
        >
          <Input
            value={line.speaker}
            aria-label={assessmentsUi.builder.speaker.en}
            placeholder={assessmentsUi.builder.speaker.en}
            disabled={disabled}
            maxLength={120}
            onChange={(event) => update(index, { speaker: event.target.value })}
          />
          <Input
            value={line.text}
            aria-label={assessmentsUi.builder.dialogueText.en}
            placeholder={assessmentsUi.builder.dialogueText.en}
            disabled={disabled}
            maxLength={4000}
            onChange={(event) => update(index, { text: event.target.value })}
          />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-label={assessmentsUi.builder.removeLine.en}
            disabled={disabled || lines.length <= 1}
            onClick={() => onChange(lines.filter((_, i) => i !== index))}
          >
            <Trash2 aria-hidden="true" className="size-3.5" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled || lines.length >= 200}
        onClick={() => onChange([...lines, { speaker: "", text: "" }])}
      >
        <Plus aria-hidden="true" className="size-3.5" />
        <Bi
          en={assessmentsUi.builder.addLine.en}
          ar={assessmentsUi.builder.addLine.ar}
        />
      </Button>
    </div>
  );
}

function SectionFields({
  draft,
  disabled,
  onChange,
}: {
  draft: SectionDraft;
  disabled: boolean;
  onChange: (draft: SectionDraft) => void;
}) {
  const patch = (values: Partial<SectionDraft>) =>
    onChange({ ...draft, ...values });

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground">
            <Bi
              en={assessmentsUi.builder.sectionKind.en}
              ar={assessmentsUi.builder.sectionKind.ar}
            />
          </label>
          <Select
            value={draft.kind}
            disabled={disabled}
            onChange={(event) => {
              const kind = event.target.value as SectionKind;
              patch({
                kind,
                dialogue_lines:
                  kind === "dialogue" && draft.dialogue_lines.length === 0
                    ? [{ speaker: "", text: "" }]
                    : draft.dialogue_lines,
              });
            }}
          >
            <option value="standard">{kindLabel("standard").en}</option>
            <option value="reading_passage">
              {kindLabel("reading_passage").en}
            </option>
            <option value="dialogue">{kindLabel("dialogue").en}</option>
          </Select>
        </div>
        <Input
          value={draft.title_en}
          aria-label={assessmentsUi.builder.sectionTitle.en}
          placeholder={assessmentsUi.builder.sectionTitle.en}
          disabled={disabled}
          maxLength={200}
          onChange={(event) => patch({ title_en: event.target.value })}
        />
      </div>

      <Textarea
        value={draft.instructions_en}
        aria-label={assessmentsUi.builder.sectionInstructions.en}
        placeholder={assessmentsUi.builder.sectionInstructions.en}
        disabled={disabled}
        maxLength={2000}
        onChange={(event) => patch({ instructions_en: event.target.value })}
      />

      {draft.kind === "reading_passage" ? (
        <>
          <Textarea
            value={draft.passage_en}
            aria-label={assessmentsUi.builder.passageText.en}
            placeholder={assessmentsUi.builder.passageText.en}
            disabled={disabled}
            maxLength={20000}
            className="min-h-40"
            onChange={(event) => patch({ passage_en: event.target.value })}
          />
          <Textarea
            value={draft.vocabulary_en}
            aria-label={assessmentsUi.builder.vocabulary.en}
            placeholder={assessmentsUi.builder.vocabulary.en}
            disabled={disabled}
            maxLength={4000}
            onChange={(event) => patch({ vocabulary_en: event.target.value })}
          />
          <Input
            value={draft.source_en}
            aria-label={assessmentsUi.builder.source.en}
            placeholder={assessmentsUi.builder.source.en}
            disabled={disabled}
            maxLength={500}
            onChange={(event) => patch({ source_en: event.target.value })}
          />
        </>
      ) : null}

      {draft.kind === "dialogue" ? (
        <>
          <DialogueEditor
            lines={draft.dialogue_lines}
            disabled={disabled}
            onChange={(lines) => patch({ dialogue_lines: lines })}
          />
          <Input
            value={draft.source_en}
            aria-label={assessmentsUi.builder.source.en}
            placeholder={assessmentsUi.builder.source.en}
            disabled={disabled}
            maxLength={500}
            onChange={(event) => patch({ source_en: event.target.value })}
          />
        </>
      ) : null}
    </div>
  );
}

function SectionContentPreview({ section }: { section: SectionView }) {
  if (section.kind === "reading_passage" && section.passage_en) {
    return (
      <div className="mt-2 rounded-lg border border-border/70 bg-background/60 p-3 text-sm text-muted-foreground">
        <p className="line-clamp-3 whitespace-pre-wrap">{section.passage_en}</p>
        {section.source_en ? (
          <p className="mt-1 text-xs italic">{section.source_en}</p>
        ) : null}
      </div>
    );
  }

  if (section.kind === "dialogue" && section.dialogue_lines.length > 0) {
    return (
      <div className="mt-2 space-y-1 rounded-lg border border-border/70 bg-background/60 p-3 text-sm">
        {section.dialogue_lines.slice(0, 4).map((line, index) => (
          <p key={index} className="text-muted-foreground">
            <span className="font-semibold text-foreground">
              {line.speaker}:
            </span>{" "}
            {line.text}
          </p>
        ))}
        {section.dialogue_lines.length > 4 ? (
          <p className="text-xs text-muted-foreground">…</p>
        ) : null}
      </div>
    );
  }

  return null;
}

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
  const [createDraft, setCreateDraft] = useState<SectionDraft>(() =>
    emptyDraft(),
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<SectionDraft>(() => emptyDraft());
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [deleteTarget, setDeleteTarget] = useState<SectionView | null>(null);
  const [moveTo, setMoveTo] = useState<string>("");

  const run = (
    action: () => Promise<{ ok: boolean; error?: AssessmentErrorCode }>,
  ) => {
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

    run(() =>
      reorderQuestionsAction({ section_id: section.id, question_ids: ids }),
    );
  };

  const createSection = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    run(async () => {
      const outcome = await createSectionAction({
        assessment_id: assessmentId,
        ...createDraft,
        dialogue_lines:
          createDraft.kind === "dialogue"
            ? createDraft.dialogue_lines.filter(
                (line) => line.speaker.trim() && line.text.trim(),
              )
            : [],
      });

      if (outcome.ok) {
        setCreateDraft(emptyDraft());
        setShowCreate(false);
      }

      return outcome;
    });
  };

  const startEditing = (section: SectionView) => {
    setEditingId(section.id);
    setDraft(draftFromSection(section));
  };

  const saveSection = (sectionId: string) => {
    run(async () => {
      const outcome = await updateSectionAction({
        section_id: sectionId,
        ...draft,
        dialogue_lines:
          draft.kind === "dialogue"
            ? draft.dialogue_lines.filter(
                (line) => line.speaker.trim() && line.text.trim(),
              )
            : [],
      });

      if (outcome.ok) {
        setEditingId(null);
      }

      return outcome;
    });
  };

  const toggleCollapsed = (sectionId: string) => {
    setCollapsed((previous) => {
      const next = new Set(previous);

      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }

      return next;
    });
  };

  const openDelete = (section: SectionView) => {
    const other = sections.find((candidate) => candidate.id !== section.id);
    setMoveTo(other?.id ?? "");
    setDeleteTarget(section);
  };

  const confirmDelete = (keepQuestions: boolean) => {
    if (!deleteTarget) {
      return;
    }

    const target = deleteTarget;
    setDeleteTarget(null);

    run(() =>
      deleteSectionAction({
        section_id: target.id,
        move_questions_to_section_id:
          keepQuestions && moveTo ? moveTo : undefined,
      }),
    );
  };

  return (
    <div className="space-y-4">
      {error ? (
        <Alert variant="error">
          <Bi
            en={assessmentErrorCopy[error].en}
            ar={assessmentErrorCopy[error].ar}
          />
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
        {sections.map((section, sectionIndex) => {
          const isCollapsed = collapsed.has(section.id);
          const otherSections = sections.filter(
            (candidate) => candidate.id !== section.id,
          );

          return (
            <li
              key={section.id}
              className="rounded-xl border border-border bg-card p-4 shadow-xs sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {editingId === section.id ? (
                    <div className="space-y-2">
                      <SectionFields
                        draft={draft}
                        disabled={pending}
                        onChange={setDraft}
                      />
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
                        <Badge variant="muted">
                          <Bi
                            en={`${assessmentsUi.builder.sections.en} ${sectionIndex + 1}`}
                            ar={`${assessmentsUi.builder.sections.ar} ${sectionIndex + 1}`}
                          />
                        </Badge>
                        <h3 className="text-base font-bold text-foreground">
                          {section.title_en}
                        </h3>
                        <SectionKindBadge kind={section.kind} />
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
                      {isCollapsed ? null : (
                        <SectionContentPreview section={section} />
                      )}
                    </div>
                  )}
                </div>

                {editingId === section.id ? null : (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label={
                        isCollapsed
                          ? assessmentsUi.builder.expand.en
                          : assessmentsUi.builder.collapse.en
                      }
                      onClick={() => toggleCollapsed(section.id)}
                    >
                      {isCollapsed ? (
                        <ChevronRight aria-hidden="true" className="size-4" />
                      ) : (
                        <ChevronDown aria-hidden="true" className="size-4" />
                      )}
                    </Button>
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
                      disabled={
                        pending || sectionIndex === sections.length - 1
                      }
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
                      onClick={() => openDelete(section)}
                    >
                      <Trash2 aria-hidden="true" className="size-3.5" />
                    </Button>
                  </div>
                )}
              </div>

              {isCollapsed ? null : (
                <>
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
                            {otherSections.length > 0 ? (
                              <Select
                                aria-label={
                                  assessmentsUi.builder.moveToGroup.en
                                }
                                className="h-8 w-40 text-xs"
                                value=""
                                disabled={pending}
                                onChange={(event) => {
                                  const sectionId = event.target.value;

                                  if (!sectionId) {
                                    return;
                                  }

                                  run(() =>
                                    moveQuestionAction({
                                      question_id: question.id,
                                      section_id: sectionId,
                                    }),
                                  );
                                }}
                              >
                                <option value="">
                                  {assessmentsUi.builder.moveToGroup.en}
                                </option>
                                {otherSections.map((candidate) => (
                                  <option key={candidate.id} value={candidate.id}>
                                    {candidate.title_en}
                                  </option>
                                ))}
                              </Select>
                            ) : null}
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
                              <ArrowUp
                                aria-hidden="true"
                                className="size-3.5"
                              />
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
                              <ArrowDown
                                aria-hidden="true"
                                className="size-3.5"
                              />
                            </Button>
                            <Link
                              href={`/teacher/assessments/${assessmentId}/questions/${question.id}`}
                              className={cn(
                                buttonVariants({
                                  variant: "outline",
                                  size: "sm",
                                }),
                              )}
                            >
                              <Pencil
                                aria-hidden="true"
                                className="size-3.5"
                              />
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
                                  deleteQuestionAction({
                                    question_id: question.id,
                                  }),
                                );
                              }}
                            >
                              <Trash2
                                aria-hidden="true"
                                className="size-3.5"
                              />
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      href={`/teacher/assessments/${assessmentId}/questions/new?section_id=${section.id}`}
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" }),
                      )}
                    >
                      <Plus aria-hidden="true" className="size-3.5" />
                      <Bi
                        en={assessmentsUi.actions.addQuestion.en}
                        ar={assessmentsUi.actions.addQuestion.ar}
                      />
                    </Link>
                    <Link
                      href={`/teacher/assessments/${assessmentId}/questions/new?section_id=${section.id}&type=essay`}
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" }),
                      )}
                    >
                      <PenLine aria-hidden="true" className="size-3.5" />
                      <Bi
                        en={assessmentsUi.builder.addEssay.en}
                        ar={assessmentsUi.builder.addEssay.ar}
                      />
                    </Link>
                    <Link
                      href={`/teacher/assessments/${assessmentId}/questions/new?section_id=${section.id}&type=paragraph`}
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" }),
                      )}
                    >
                      <PenLine aria-hidden="true" className="size-3.5" />
                      <Bi
                        en={assessmentsUi.builder.addParagraph.en}
                        ar={assessmentsUi.builder.addParagraph.ar}
                      />
                    </Link>
                  </div>
                </>
              )}

              {deleteTarget?.id === section.id ? (
                <div className="mt-3 space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <p className="text-sm font-semibold text-foreground">
                    <Bi
                      en={assessmentsUi.builder.confirmDeleteSection.en}
                      ar={assessmentsUi.builder.confirmDeleteSection.ar}
                    />
                  </p>
                  {section.questions.length > 0 && otherSections.length > 0 ? (
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="min-w-48 flex-1 space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground">
                          <Bi
                            en={assessmentsUi.builder.moveToGroup.en}
                            ar={assessmentsUi.builder.moveToGroup.ar}
                          />
                        </label>
                        <Select
                          value={moveTo}
                          onChange={(event) => setMoveTo(event.target.value)}
                        >
                          {otherSections.map((candidate) => (
                            <option key={candidate.id} value={candidate.id}>
                              {candidate.title_en}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        disabled={pending || !moveTo}
                        onClick={() => confirmDelete(true)}
                      >
                        <ArrowRightLeft
                          aria-hidden="true"
                          className="size-3.5"
                        />
                        <Bi
                          en={assessmentsUi.builder.moveToGroup.en}
                          ar={assessmentsUi.builder.moveToGroup.ar}
                        />
                      </Button>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={pending}
                      onClick={() => confirmDelete(false)}
                    >
                      <Trash2 aria-hidden="true" className="size-3.5" />
                      <Bi
                        en={assessmentsUi.actions.delete.en}
                        ar={assessmentsUi.actions.delete.ar}
                      />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setDeleteTarget(null)}
                    >
                      <Bi
                        en={assessmentsUi.actions.cancel.en}
                        ar={assessmentsUi.actions.cancel.ar}
                      />
                    </Button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      {showCreate ? (
        <form
          onSubmit={createSection}
          className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-xs sm:p-5"
        >
          <SectionFields
            draft={createDraft}
            disabled={pending}
            onChange={setCreateDraft}
          />
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
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setCreateDraft(emptyDraft("standard"));
              setShowCreate(true);
            }}
          >
            <Plus aria-hidden="true" className="size-4" />
            <Bi
              en={assessmentsUi.actions.addSection.en}
              ar={assessmentsUi.actions.addSection.ar}
            />
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setCreateDraft(emptyDraft("reading_passage"));
              setShowCreate(true);
            }}
          >
            <BookOpen aria-hidden="true" className="size-4" />
            <Bi
              en={assessmentsUi.builder.addReadingPassage.en}
              ar={assessmentsUi.builder.addReadingPassage.ar}
            />
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setCreateDraft(emptyDraft("dialogue"));
              setShowCreate(true);
            }}
          >
            <MessagesSquare aria-hidden="true" className="size-4" />
            <Bi
              en={assessmentsUi.builder.addDialogue.en}
              ar={assessmentsUi.builder.addDialogue.ar}
            />
          </Button>
        </div>
      )}
    </div>
  );
}
