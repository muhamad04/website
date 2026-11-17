import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import {
  CalendarDays,
  FileText,
  FolderOpen,
  GraduationCap,
  Image as ImageIcon,
  MonitorPlay,
} from "lucide-react";
import { Bi } from "@/components/bilingual";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { ResourceRecord, ResourceType } from "@/lib/domain/types";
import {
  resourceStatusCopy,
  resourceTypeCopy,
  resourcesUi,
} from "@/lib/i18n/resources";
import { formatAdminDate } from "@/lib/students/format";

const typeIcons: Record<ResourceType, typeof FileText> = {
  pdf: FileText,
  image: ImageIcon,
  youtube: MonitorPlay,
};

export function ResourceCard({
  resource,
  href,
  actions,
  showGrade = false,
  showStatus = true,
  date = "updated",
}: {
  resource: ResourceRecord;
  href: string;
  actions?: ReactNode;
  showGrade?: boolean;
  showStatus?: boolean;
  date?: "created" | "updated";
}) {
  const Icon = typeIcons[resource.type];
  const type = resourceTypeCopy[resource.type];
  const status = resourceStatusCopy[resource.is_published ? "published" : "draft"];
  const dateValue =
    date === "created" ? resource.created_at : resource.updated_at;

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <Link
        href={href}
        className="group relative block aspect-video overflow-hidden bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        aria-label={`${resourcesUi.actions.open.en} / ${resourcesUi.actions.open.ar}: ${resource.title_en}`}
      >
        {resource.type === "youtube" && resource.thumbnail_url ? (
          <Image
            src={resource.thumbnail_url}
            alt=""
            fill
            sizes="(min-width: 1280px) 30vw, (min-width: 640px) 45vw, 100vw"
            className="object-cover transition-transform duration-200 group-hover:scale-[1.02]"
          />
        ) : (
          <span className="flex h-full items-center justify-center text-primary">
            <Icon aria-hidden="true" className="size-12" />
          </span>
        )}
      </Link>

      <CardContent className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline">
            <Icon aria-hidden="true" className="size-3" />
            <Bi en={type.en} ar={type.ar} hideSeparator />
          </Badge>
          {showStatus ? (
            <Badge variant={resource.is_published ? "success" : "muted"}>
              <Bi en={status.en} ar={status.ar} hideSeparator />
            </Badge>
          ) : null}
          {resource.category ? (
            <Badge variant="default">
              <Bi
                en={resource.category.name_en}
                ar={resource.category.name_ar}
                hideSeparator
              />
            </Badge>
          ) : null}
        </div>

        <div className="min-w-0">
          <Link
            href={href}
            className="block font-semibold leading-snug text-foreground hover:text-primary"
          >
            {resource.title_en}
          </Link>
          <p
            lang="ar"
            dir="rtl"
            className="font-arabic mt-0.5 text-sm leading-relaxed text-muted-foreground"
          >
            {resource.title_ar}
          </p>
        </div>

        {resource.description_en || resource.description_ar ? (
          <div className="space-y-1 text-sm text-muted-foreground">
            {resource.description_en ? (
              <p className="line-clamp-2">{resource.description_en}</p>
            ) : null}
            {resource.description_ar ? (
              <p
                lang="ar"
                dir="rtl"
                className="font-arabic line-clamp-2 text-xs"
              >
                {resource.description_ar}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-auto space-y-2 pt-2 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {showGrade && resource.grade ? (
              <span className="inline-flex items-center gap-1">
                <GraduationCap aria-hidden="true" className="size-3.5" />
                <Bi
                  en={resource.grade.name_en}
                  ar={resource.grade.name_ar}
                  hideSeparator
                />
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1">
              <CalendarDays aria-hidden="true" className="size-3.5" />
              {formatAdminDate(dateValue)}
            </span>
            {resource.type !== "youtube" ? (
              <span className="inline-flex items-center gap-1">
                <FolderOpen aria-hidden="true" className="size-3.5" />
                <Bi
                  en={resourcesUi.detail.fileResource.en}
                  ar={resourcesUi.detail.fileResource.ar}
                  hideSeparator
                />
              </span>
            ) : null}
          </div>

          {actions ? (
            <div className="flex flex-wrap items-center gap-2">{actions}</div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
