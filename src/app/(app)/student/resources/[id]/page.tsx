import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  FolderOpen,
  GraduationCap,
  Tags,
} from "lucide-react";
import { Bi } from "@/components/bilingual";
import { PageHeader } from "@/components/layout/page-header";
import { ResourceViewer } from "@/components/resources/resource-viewer";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireStudent } from "@/lib/auth/dal";
import { getStudentResourceById } from "@/lib/data/resources";
import {
  resourceTypeCopy,
  resourcesUi,
} from "@/lib/i18n/resources";
import { isUuid } from "@/lib/search";
import { createSignedResourceUrl } from "@/lib/resources/storage";
import { youtubeIdFromUrl } from "@/lib/resources/youtube";
import { formatAdminDateTime } from "@/lib/students/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Resource",
};

export const dynamic = "force-dynamic";

export default async function StudentResourceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireStudent();
  const grade = profile.grade!;
  const { id } = await params;

  if (!isUuid(id)) {
    notFound();
  }

  const resource = await getStudentResourceById(id, grade.id);

  if (!resource) {
    notFound();
  }

  const signedUrl = resource.storage_path
    ? await createSignedResourceUrl(resource.storage_path)
    : null;
  const youtubeId =
    resource.type === "youtube"
      ? youtubeIdFromUrl(resource.external_url)
      : null;
  const type = resourceTypeCopy[resource.type];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={
          <Bi en={resourcesUi.student.title.en} ar={resourcesUi.student.title.en} />
        }
        title={
          <Bi en={resource.title_en} ar={resource.title_en} layout="stacked" />
        }
        description={
          <Bi
            en={resourcesUi.student.subtitle.en}
            ar={resourcesUi.student.subtitle.en}
          />
        }
        actions={
          <Badge variant="success">
            <Bi
              en={resourcesUi.student.gradeLocked.en}
              ar={resourcesUi.student.gradeLocked.en}
            />
          </Badge>
        }
      />

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link
          href="/student/resources"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        >
          <ArrowLeft aria-hidden="true" className="size-3.5" />
          <Bi
            en={resourcesUi.actions.backToList.en}
            ar={resourcesUi.actions.backToList.en}
          />
        </Link>
        <Badge variant="outline">
          <Bi en={type.en} ar={type.en} hideSeparator />
        </Badge>
        {resource.category ? (
          <Badge variant="default">
            <Bi
              en={resource.category.name_en}
              ar={resource.category.name_en}
              hideSeparator
            />
          </Badge>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>
              <Bi
                en={resourcesUi.detail.previewTitle.en}
                ar={resourcesUi.detail.previewTitle.en}
              />
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              <Bi
                en={resourcesUi.detail.noDownload.en}
                ar={resourcesUi.detail.noDownload.en}
              />
            </p>
          </CardHeader>
          <CardContent>
            <ResourceViewer
              type={resource.type}
              signedUrl={signedUrl}
              youtubeId={youtubeId}
              titleEn={resource.title_en}
            />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>
                <Bi
                  en={resourcesUi.detail.detailsTitle.en}
                  ar={resourcesUi.detail.detailsTitle.en}
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
                        ar={resourcesUi.detail.grade.en}
                      />
                    </dt>
                    <dd className="mt-0.5">
                      <Bi
                        en={grade.name_en}
                        ar={grade.name_en}
                        layout="stacked"
                      />
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
                        ar={resourcesUi.detail.category.en}
                      />
                    </dt>
                    <dd className="mt-0.5">
                      {resource.category ? (
                        <Bi
                          en={resource.category.name_en}
                          ar={resource.category.name_en}
                          layout="stacked"
                        />
                      ) : (
                        <Bi
                          en={resourcesUi.detail.noCategory.en}
                          ar={resourcesUi.detail.noCategory.en}
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
                        ar={resourcesUi.detail.type.en}
                      />
                    </dt>
                    <dd className="mt-0.5">
                      <Bi en={type.en} ar={type.en} />
                    </dd>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <CalendarDays
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-primary"
                  />
                  <div className="min-w-0">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <Bi
                        en={resourcesUi.detail.updatedAt.en}
                        ar={resourcesUi.detail.updatedAt.en}
                      />
                    </dt>
                    <dd className="mt-0.5 text-xs">
                      {formatAdminDateTime(resource.updated_at)}
                    </dd>
                  </div>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                <Bi
                  en={resourcesUi.detail.descriptionTitle.en}
                  ar={resourcesUi.detail.descriptionTitle.en}
                />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm leading-relaxed">
              {resource.description_en ? (
                <p>{resource.description_en}</p>
              ) : (
                <p className="text-muted-foreground">
                  <Bi en="No description yet." ar="No description yet." />
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {signedUrl === null && resource.type !== "youtube" ? (
        <Alert variant="error">
          <Bi
            en={resourcesUi.detail.previewUnavailableHint.en}
            ar={resourcesUi.detail.previewUnavailableHint.en}
          />
        </Alert>
      ) : null}
    </div>
  );
}
