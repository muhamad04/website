import { ui } from "@/lib/i18n/dictionary";

export function AppFooter() {
  return (
    <footer className="border-t border-border/70 bg-card/40">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <span>
          {ui.appName.en} · {ui.appTagline.en}
        </span>
        <span>Grade-scoped access · Secure accounts</span>
      </div>
    </footer>
  );
}
