import type { Metadata, Viewport } from "next";
import { Bi } from "@/components/bilingual";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "English Hub · منصة الإنجليزية",
    template: "%s · English Hub",
  },
  description:
    "Bilingual English teaching resources and assessments for teachers and students in Egypt. منصة ثنائية اللغة للمصادر والتقييمات.",
  applicationName: "English Hub",
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0d5c54",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" dir="ltr">
      <body className="flex min-h-svh flex-col">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
        >
          <Bi en="Skip to content" ar="تجاوز إلى المحتوى" />
        </a>
        {children}
      </body>
    </html>
  );
}
