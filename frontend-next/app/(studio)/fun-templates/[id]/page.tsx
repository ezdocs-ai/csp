/** Copyright 2026 Google LLC — Apache-2.0 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Badge } from "@/src/components/ui/badge";
import { Card } from "@/src/components/ui/card";
import { UseTemplateButton, type MediaTemplate } from "@/src/features/templates";
import { getServerApiClient } from "@/src/lib/api/server";

type PageProps = { params: Promise<{ id: string }> };

async function getTemplate(id: string): Promise<MediaTemplate> {
  const api = await getServerApiClient();
  if (!api) redirect("/");
  try {
    return await api.get(`/api/media-templates/${id}`);
  } catch {
    notFound();
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const template = await getTemplate(id);
  return { title: template.name };
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  const template = await getTemplate(id);
  const gen = template.generationParameters ?? {};
  // Detail endpoint serves MediaTemplateModel (raw GCS URIs, NO presigned URLs),
  // so there is no browser-displayable preview here. Backend gap; not invented.

  return (
    <section className="mx-auto max-w-4xl space-y-[var(--tri-space-6)] text-[var(--tri-text-primary)]">
      <Link className="inline-flex min-h-11 items-center text-[var(--tri-text-primary)]" href="/fun-templates">
        Back to templates
      </Link>
      <Card className="overflow-hidden bg-[var(--tri-bg-surface)]">
        <div className="grid lg:grid-cols-2">
          <div className="grid place-items-center bg-[var(--tri-bg-surface-alt)] p-[var(--tri-space-6)] text-[var(--tri-text-secondary)]">
            <span aria-hidden>No preview available</span>
          </div>
          <div className="space-y-[var(--tri-space-4)] p-[var(--tri-space-6)]">
            <h1 className="text-3xl font-semibold">{template.name}</h1>
            {template.description ? (
              <p className="text-[var(--tri-text-secondary)]">{template.description}</p>
            ) : null}
            <div className="flex flex-wrap gap-[var(--tri-space-2)]">
              {template.industry ? <Badge>{template.industry}</Badge> : null}
              {template.brand ? <Badge>{template.brand}</Badge> : null}
              {gen.model ? <Badge>{gen.model}</Badge> : null}
              {template.tags?.map((tag) => <Badge key={tag}>{tag}</Badge>)}
            </div>
            {gen.prompt ? (
              <div className="space-y-[var(--tri-space-2)]">
                <h2 className="font-semibold">Prompt</h2>
                <p className="whitespace-pre-wrap text-[var(--tri-text-secondary)]">{gen.prompt}</p>
              </div>
            ) : null}
            <UseTemplateButton template={template} />
          </div>
        </div>
      </Card>
    </section>
  );
}
