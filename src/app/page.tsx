import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/dal";
import { isSupabaseConfigured } from "@/lib/env";
import { dashboardPathForRole } from "@/lib/domain/roles";
import { SupabaseSetupNotice } from "@/components/layout/supabase-setup-notice";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  if (!isSupabaseConfigured()) {
    return (
      <main
        id="main-content"
        className="flex flex-1 items-center justify-center px-4 py-12"
      >
        <SupabaseSetupNotice bilingual />
      </main>
    );
  }

  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  if (!profile.is_active) {
    redirect("/account-disabled");
  }

  redirect(dashboardPathForRole(profile.role));
}
