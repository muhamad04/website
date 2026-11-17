import { Database, Terminal } from "lucide-react";
import { Bi } from "@/components/bilingual";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";

export function SupabaseSetupNotice() {
  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <span className="flex size-11 items-center justify-center rounded-xl bg-secondary text-primary">
          <Database aria-hidden="true" className="size-5" />
        </span>
        <CardTitle className="mt-2 text-xl">
          <Bi
            en="Connect Supabase to finish setup"
            ar="اربط Supabase لإكمال الإعداد"
            layout="stacked"
          />
        </CardTitle>
        <p className="text-sm leading-relaxed text-muted-foreground">
          <Bi
            en="The app is running, but the database credentials are missing. Everything else will work once Supabase is connected."
            ar="التطبيق يعمل، لكن بيانات الاتصال بقاعدة البيانات غير موجودة. سيعمل كل شيء بعد ربط Supabase."
          />
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <Alert variant="info">
          <p className="font-semibold">
            <Bi en="1. Copy the environment template" ar="١. انسخ قالب المتغيرات" />
          </p>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-foreground p-3 text-xs text-background">
            <code>copy .env.example .env.local</code>
          </pre>
        </Alert>

        <div className="space-y-2 text-sm">
          <p className="font-semibold">
            <Bi en="2. Start local Supabase" ar="٢. شغّل Supabase محليًا" />
          </p>
          <div className="flex items-start gap-2 rounded-lg border border-border bg-secondary/40 p-3">
            <Terminal aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 space-y-1 text-xs">
              <code className="block">npx supabase start</code>
              <code className="block">npm run db:reset</code>
            </div>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            <Bi
              en="Copy the API URL and publishable (anon) key printed by the CLI into .env.local, then restart the dev server."
              ar="انسخ رابط API والمفتاح القابل للنشر (publishable/anon) من سطر الأوامر إلى ملف .env.local ثم أعد تشغيل خادم التطوير."
            />
          </p>
        </div>

        <div className="space-y-2 text-sm">
          <p className="font-semibold">
            <Bi en="3. Required variables" ar="٣. المتغيرات المطلوبة" />
          </p>
          <ul className="grid gap-1 rounded-lg border border-border bg-secondary/30 p-3 font-mono text-xs">
            <li>NEXT_PUBLIC_SUPABASE_URL</li>
            <li>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</li>
            <li className="text-muted-foreground">
              SUPABASE_SERVICE_ROLE_KEY (server only)
            </li>
          </ul>
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">
          <Bi
            en="Full instructions, demo accounts and deployment notes are in README.md."
            ar="التعليمات الكاملة وحسابات التجربة وخطوات النشر موجودة في ملف README.md."
          />
        </p>
      </CardContent>
    </Card>
  );
}
