/** Copyright 2026 Google LLC — Apache-2.0 */
import Link from "next/link";

// Angular `footer.component.ts` — opens in a new tab.
const PRIVACY_URL = "https://policies.google.com/privacy?hl=en-US";

export function Footer() {
  return (
    <footer className="flex flex-wrap items-center justify-center gap-x-[var(--tri-space-6)] gap-y-2 px-[var(--tri-layout-gutter)] py-[var(--tri-space-4)] text-center text-[length:var(--tri-text-small-size)] text-[var(--tri-text-secondary)]">
      <span>
        Powered by{" "}
        <span className="bg-gradient-to-r from-blue-500 via-violet-500 to-red-400 bg-clip-text text-transparent">
          Vertex AI
        </span>
      </span>
      <a className="hover:text-[var(--tri-text-primary)]" href={PRIVACY_URL} rel="noreferrer" target="_blank">
        Privacy policy
      </a>
      <Link className="hover:text-[var(--tri-text-primary)]" href="/terms-of-service">
        Terms and services
      </Link>
    </footer>
  );
}
