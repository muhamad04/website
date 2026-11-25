import type { Metadata } from "next";

/**
 * Browser auto-translation is discouraged on assessment pages: machine
 * translation can rewrite prompts, choices, instructions and warnings while a
 * student is answering. This layout wraps every `/student/assessments/[id]`
 * route (pre-start confirmation, timed runner and result screen) so the whole
 * assessment shell opts out. It does not touch the rest of the site.
 */
export const metadata: Metadata = {
  other: {
    google: "notranslate",
  },
};

export default function StudentAssessmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div translate="no" className="notranslate">
      {children}
    </div>
  );
}
