import Link from "next/link";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <main
      id="main-content"
      className="flex flex-1 items-center justify-center px-4 py-12"
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-center shadow-sm">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
          <FileQuestion aria-hidden="true" className="size-6" />
        </span>
        <h1 className="mt-4 text-xl font-bold">Page not found</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          The page you asked for does not exist, or you may not have access to
          it.
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
