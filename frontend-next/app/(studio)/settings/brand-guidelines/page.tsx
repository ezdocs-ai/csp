/** Copyright 2026 Google LLC — Apache-2.0 */
import { BrandGuidelineUpload } from "@/src/features/brand-guidelines";
import { requireUser } from "@/src/lib/auth/server";

export default async function BrandGuidelinesPage() {
  const session = await requireUser();
  return (
    <section className="space-y-6">
      <header>
        <p className="text-sm text-[var(--tri-text-secondary)]">Settings</p>
        <h1 className="text-2xl font-semibold text-[var(--tri-text)]">Brand guidelines</h1>
      </header>
      <BrandGuidelineUpload isAdmin={session.roles.includes("admin")} userId={session.sub} />
    </section>
  );
}
