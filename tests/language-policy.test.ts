import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Bi } from "@/components/bilingual";
import { FormError } from "@/components/form-error";
import { FormMessage } from "@/components/form-message";
import { SupabaseSetupNotice } from "@/components/layout/supabase-setup-notice";

const root = process.cwd();

const ARABIC = /[\u0600-\u06FF]/;
const dashboard = { en: "Dashboard", ar: "لوحة التحكم" };

describe("Bi language policy", () => {
  it("renders only English by default", () => {
    const markup = renderToStaticMarkup(createElement(Bi, dashboard));

    expect(markup).toContain("Dashboard");
    expect(markup).not.toMatch(ARABIC);
    expect(markup).toContain('lang="en"');
    expect(markup).not.toContain('lang="ar"');
  });

  it("renders English and Arabic when bilingual is opted in", () => {
    const markup = renderToStaticMarkup(
      createElement(Bi, { ...dashboard, bilingual: true }),
    );

    expect(markup).toContain("Dashboard");
    expect(markup).toMatch(ARABIC);
    expect(markup).toContain('lang="en"');
    expect(markup).toContain('lang="ar"');
    expect(markup).toContain('dir="rtl"');
  });
});

describe("form copy follows the language policy", () => {
  const copy = { en: "Invalid password", ar: "كلمة مرور غير صالحة" };

  it("renders FormError English-only by default", () => {
    const markup = renderToStaticMarkup(createElement(FormError, { copy }));

    expect(markup).toContain("Invalid password");
    expect(markup).not.toMatch(ARABIC);
  });

  it("renders FormError bilingually on authentication screens", () => {
    const markup = renderToStaticMarkup(
      createElement(FormError, { copy, bilingual: true }),
    );

    expect(markup).toContain("Invalid password");
    expect(markup).toMatch(ARABIC);
  });

  it("renders FormMessage English-only by default", () => {
    const markup = renderToStaticMarkup(
      createElement(FormMessage, { message: "password_required" }),
    );

    expect(markup).toContain("Enter your password.");
    expect(markup).not.toMatch(ARABIC);
  });
});

describe("Supabase setup notice language policy", () => {
  it("stays English-only inside the normal application shell", () => {
    const markup = renderToStaticMarkup(createElement(SupabaseSetupNotice));

    expect(markup).toContain("Connect Supabase to finish setup");
    expect(markup).not.toMatch(ARABIC);
  });

  it("renders bilingually on authentication and setup pages", () => {
    const markup = renderToStaticMarkup(
      createElement(SupabaseSetupNotice, { bilingual: true }),
    );

    expect(markup).toContain("Connect Supabase to finish setup");
    expect(markup).toMatch(ARABIC);
  });

  it("opts into bilingual copy only on setup and authentication pages", () => {
    const read = (relativePath: string) =>
      readFileSync(join(root, relativePath), "utf-8");

    expect(read("src/app/(app)/layout.tsx")).toContain(
      "<SupabaseSetupNotice />",
    );
    expect(read("src/app/(app)/layout.tsx")).not.toContain(
      "<SupabaseSetupNotice bilingual",
    );

    for (const page of [
      "src/app/page.tsx",
      "src/app/login/page.tsx",
      "src/app/account-pending/page.tsx",
      "src/app/account-disabled/page.tsx",
    ]) {
      expect(read(page), page).toContain("<SupabaseSetupNotice bilingual />");
    }
  });
});
