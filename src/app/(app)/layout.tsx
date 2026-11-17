import { AppFooter } from "@/components/layout/app-footer";
import { AppHeader } from "@/components/layout/app-header";
import { SupabaseSetupNotice } from "@/components/layout/supabase-setup-notice";
import { requireProfile } from "@/lib/auth/dal";
import { isSupabaseConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isSupabaseConfigured()) {
    return (
      <main
        id="main-content"
        className="flex flex-1 items-center justify-center px-4 py-12"
      >
        <SupabaseSetupNotice />
      </main>
    );
  }

  const profile = await requireProfile();

  return (
    <div className="flex min-h-svh flex-col">
      <AppHeader profile={profile} />
      <main
        id="main-content"
        className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8"
      >
        {children}
      </main>
      <AppFooter />
    </div>
  );
}
