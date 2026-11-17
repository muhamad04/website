import { Bi } from "@/components/bilingual";
import { ui } from "@/lib/i18n/dictionary";

export function AppFooter() {
  return (
    <footer className="border-t border-border/70 bg-card/40">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <Bi
          en={`${ui.appName.en} · ${ui.appTagline.en}`}
          ar={`${ui.appName.ar} · ${ui.appTagline.ar}`}
        />
        <Bi
          en="Grade-scoped access · Secure accounts"
          ar="وصول حسب الصف · حسابات آمنة"
        />
      </div>
    </footer>
  );
}
