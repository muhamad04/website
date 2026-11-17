import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  ExternalLink,
  FolderOpen,
  GraduationCap,
  Pencil,
  Tags,
} from "lucide-react";
import { Bi } from "@/components/bilingual";
import { PageHeader } from "@/components/layout/page-header";
import { ResourceViewer } from "@/components/resources/resource-viewer";
import {
  DeleteResourceButton,
  ResourcePublishToggle,
} from "@/app/(app)/teacher/resources/resource-actions";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { requireTeacher } from "@/lib/auth/dal";
import {
  getTeacherResourceById,
  listResourceAdminEvents,
} from "@/lib/data/resources";
import {
  resourceEventCopy,
  resourceStatusCopy,
  resourceTypeCopy,
  resourcesUi,
} from "@/lib/i18n/resources";
import { isUuid } from "@/lib/search";
import { createSignedResourceUrl } from "@/lib/resources/storage";
import { youtubeIdFromUrl } from "@/lib/resources/youtube";
import { formatAdminDateTime } from "@/lib/students/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Resource · المصدر",
};

export const dynamic = "force-dynamic";

export default async function TeacherResourceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireTeacher();

  const { id } = await params;
  const query = await searchParams;

  if (!isUuid(id)) {
    notFound();
  }

  const resource = await getTeacherResourceById(id);

  if (!resource) {
    notFound();
  }

  const [events, signedUrl] = await Promise.all([
    listResourceAdminEvents(resource.id),
    resource.storage_path
      ? createSignedResourceUrl(resource.storage_path)
      : Promise.resolve(null),
  ]);

  const youtubeId =
    resource.type === "youtube"
      ? youtubeIdFromUrl(resource.external_url)
      : null;
  const type = resourceTypeCopy[resource.type];
  const status = resourceStatusCopy[resource.is_published ? "published" : "draft"];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={<Bi en={resourcesUi.eyebrow.en} ar={resourcesUi.eyebrow.ar} />}
        title={
          <Bi
            en={resource.title_en}
            ar={resource.title_ar}
            layout="stacked"
          />
        }
        description={
          <Bi
            en={resourcesUi.detail.detailsTitle.en}
            ar={resourcesUi.detail.detailsTitle.ar}
          />
        }
        actions={
          <>
            <Badge variant={resource.is_published ? "success" : "muted"}>
              <Bi en={status.en} ar={status.ar} hideSeparator />
            </Badge>
            <ResourcePublishToggle
              resourceId={resource.id}
              isPublished={resource.is_published}
            />
            <Link
              href={`/teacher/resources/${resource.id}/edit`}
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              <Pencil aria-hidden="true" className="size-4" />
              <Bi
                en={resourcesUi.actions.edit.en}
                ar={resourcesUi.actions.edit.ar}
              />
            </Link>
            <DeleteResourceButton resourceId={resource.id} redirectToList />
          </>
        }
      />

      {query.created === "1" ? (
        <Alert variant="success">
          <Bi
            en={resourcesUi.detail.createdSuccess.en}
            ar={resourcesUi.detail.createdSuccess.ar}
          />
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link
          href="/teacher/resources"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        >
          <ArrowLeft aria-hidden="true" className="size-3.5" />
          <Bi
            en={resourcesUi.actions.backToList.en}
            ar={resourcesUi.actions.backToList.ar}
          />
        </Link>
        {resource.type === "youtube" && resource.external_url ? (
          <a
            href={resource.external_url}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <ExternalLink aria-hidden="true" className="size-3.5" />
            <Bi en="Open on YouTube" ar="فتح على يوتيوب" />
          </a>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>
              <Bi
                en={resourcesUi.detail.previewTitle.en}
                ar={resourcesUi.detail.previewTitle.ar}
              />
            </CardTitle>
            <CardDescription>
              <Bi
                en={resourcesUi.detail.noDownload.en}
                ar={resourcesUi.detail.noDownload.ar}
              />
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResourceViewer
              type={resource.type}
              signedUrl={signedUrl}
              youtubeId={youtubeId}
              titleEn={resource.title_en}
              titleAr={resource.title_ar}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <Bi
                en={resourcesUi.detail.detailsTitle.en}
                ar={resourcesUi.detail.detailsTitle.ar}
              />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              <div className="flex items-start gap-2.5">
                <GraduationCap
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-primary"
                />
                <div className="min-w-0">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Bi
                      en={resourcesUi.detail.grade.en}
                      ar={resourcesUi.detail.grade.ar}
                    />
                  </dt>
                  <dd className="mt-0.5">
                    {resource.grade ? (
                      <Bi
                        en={resource.grade.name_en}
                        ar={resource.grade.name_ar}
                        layout="stacked"
                      />
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Tags
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-primary"
                />
                <div className="min-w-0">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Bi
                      en={resourcesUi.detail.category.en}
                      ar={resourcesUi.detail.category.ar}
                    />
                  </dt>
                  <dd className="mt-0.5">
                    {resource.category ? (
                      <Bi
                        en={resource.category.name_en}
                        ar={resource.category.name_ar}
                        layout="stacked"
                      />
                    ) : (
                      <Bi
                        en={resourcesUi.detail.noCategory.en}
                        ar={resourcesUi.detail.noCategory.ar}
                      />
                    )}
                  </dd>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <FolderOpen
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-primary"
                />
                <div className="min-w-0">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Bi
                      en={resourcesUi.detail.type.en}
                      ar={resourcesUi.detail.type.ar}
                    />
                  </dt>
                  <dd className="mt-0.5">
                    <Bi en={type.en} ar={type.ar} />
                  </dd>
                  {resource.storage_path ? (
                    <dd className="mt-1 break-all text-xs text-muted-foreground">
                      {resource.storage_path.split("/").slice(-1)[0]}
                    </dd>
                  ) : null}
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <CalendarDays
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-primary"
                />
                <div className="min-w-0 space-y-1">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Bi
                      en={resourcesUi.detail.createdAt.en}
                      ar={resourcesUi.detail.createdAt.ar}
                    />
                  </dt>
                  <dd className="text-xs">{formatAdminDateTime(resource.created_at)}</dd>
                  <dt className="pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Bi
                      en={resourcesUi.detail.updatedAt.en}
                      ar={resourcesUi.detail.updatedAt.ar}
                    />
                  </dt>
                  <dd className="text-xs">{formatAdminDateTime(resource.updated_at)}</dd>
                </div>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              <Bi
                en={resourcesUi.detail.descriptionTitle.en}
                ar={resourcesUi.detail.descriptionTitle.ar}
              />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm leading-relaxed">
            {resource.description_en ? (
              <p>{resource.description_en}</p>
            ) : null}
            {resource.description_ar ? (
              <p lang="ar" dir="rtl" className="font-arabic">
                {resource.description_ar}
              </p>
            ) : null}
            {!resource.description_en && !resource.description_ar ? (
              <p className="text-muted-foreground">
                <Bi
                  en="No description yet."
                  ar="لا يوجد وصف بعد."
                />
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <Bi
                en={resourcesUi.detail.activityTitle.en}
                ar={resourcesUi.detail.activityTitle.ar}
              />
            </CardTitle>
            <CardDescription>
              <Bi
                en={resourcesUi.detail.activityHint.en}
                ar={resourcesUi.detail.activityHint.ar}
              />
            </CardDescription>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title={
                  <Bi
                    en={resourcesUi.detail.noActivity.en}
                    ar={resourcesUi.detail.noActivity.ar}
                  />
                }
                description={
                  <Bi
                    en={resourcesUi.detail.activityHint.en}
                    ar={resourcesUi.detail.activityHint.ar}
                  />
                }
              />
            ) : (
              <ol className="space-y-3">
                {events.map((event) => (
                  <li key={event.id} className="flex gap-3 text-sm">
                    <span
                      aria-hidden="true"
                      className="mt-1.5 size-2 shrink-0 rounded-full bg-primary"
                    />
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">
                        <Bi
                          en={resourceEventCopy[event.action].en}
                          ar={resourceEventCopy[event.action].ar}
                        />
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatAdminDateTime(event.created_at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
