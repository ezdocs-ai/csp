/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { Metadata } from "next";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  Input,
  Sidebar,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Topbar,
} from "@/src/components/ui";
import { DialogSpecimen, InteractiveFeedbackSpecimens } from "./_interactive-specimens";

export const metadata: Metadata = { robots: { index: false, follow: false } };

type Props = { searchParams: Promise<{ theme?: string }> };

const swatches = [
  ["Deep forest", "--tri-bg-inverse", "var(--tri-text-inverse)"],
  ["Luminous green", "--tri-brand-luminous", "var(--tri-bg-inverse)"],
  ["Intelligence violet", "--tri-brand-violet", "var(--tri-brand-on-primary)"],
  ["Signal coral", "--tri-brand-coral", "var(--tri-brand-on-primary)"],
] as const;

export default async function VisualPage({ searchParams }: Props) {
  const { theme } = await searchParams;
  const selectedTheme = theme === "dark" ? "dark" : "light";

  return <div data-theme={selectedTheme} className="min-h-screen bg-[var(--tri-bg-page)] text-[var(--tri-text-primary)]">
    <div className="grid min-h-screen md:grid-cols-[var(--tri-nav-sidebar-width)_minmax(0,1fr)]">
      <Sidebar brand={<strong className="font-[var(--tri-font-display)]">tridorian <span className="text-[var(--tri-brand-luminous)]">v3</span></strong>} items={[{ label: "Overview", href: "#overview", active: true }, { label: "System", href: "#system" }, { label: "Components", href: "#components" }]} footer={<p className="text-[var(--tri-text-tertiary)]">Agent-ready system</p>} />
      <main className="min-w-0">
        <Topbar><p className="text-[var(--tri-text-small-size)] text-[var(--tri-text-tertiary)]">Design system / <strong className="text-[var(--tri-text-primary)]">Tridorian</strong></p><IconButton label="Visual fixture settings">⚙</IconButton></Topbar>
        <div className="mx-auto max-w-[var(--tri-layout-wide)] p-[var(--tri-layout-gutter)]">
          <section id="overview" className="overflow-hidden rounded-[var(--tri-radius-2xl)] bg-[var(--tri-gradient-forest-depth)] p-[clamp(24px,5vw,64px)] text-[var(--tri-text-inverse)] shadow-[var(--tri-shadow-lg)]">
            <p className="text-[var(--tri-label-eyebrow-size)] font-[var(--tri-font-weight-semibold)] uppercase tracking-[var(--tri-label-eyebrow-tracking)] text-[var(--tri-brand-luminous)]">Agent-ready design language</p>
            <div className="mt-[var(--tri-space-5)] grid gap-[var(--tri-space-10)] lg:grid-cols-[1.25fr_.75fr] lg:items-end"><div><h1 className="max-w-[12ch] font-[var(--tri-font-display)] text-[var(--tri-text-hero-size)] leading-[var(--tri-text-hero-line-height)] tracking-[var(--tri-text-hero-tracking)]">Quietly bold. Built to think.</h1><p className="mt-[var(--tri-space-6)] max-w-[var(--tri-measure-reading)] text-[var(--tri-text-large-size)] text-[var(--tri-text-secondary)]">Deep-green identity. Clear product language. Premium without noise.</p><div className="mt-[var(--tri-space-6)] flex flex-wrap gap-[var(--tri-space-3)]"><Button>Primary action</Button><Button variant="secondary">Explore system</Button></div></div><div className="rounded-[var(--tri-radius-xl)] border border-[var(--tri-border-inverse)] bg-[var(--tri-bg-surface-tint)] p-[var(--tri-space-5)]"><p className="text-[var(--tri-label-overline-size)] uppercase tracking-[var(--tri-label-overline-tracking)]">System confidence</p><p className="font-[var(--tri-font-display)] text-[3rem] leading-none">96 <span className="text-[var(--tri-text-small-size)] text-[var(--tri-brand-luminous)]">+8.4%</span></p><div className="mt-[var(--tri-space-4)] flex h-20 items-end gap-2" aria-label="Performance rising"><i className="h-1/3 flex-1 rounded-t bg-[var(--tri-brand-luminous)]"/><i className="h-1/2 flex-1 rounded-t bg-[var(--tri-brand-luminous)]"/><i className="h-2/3 flex-1 rounded-t bg-[var(--tri-brand-luminous)]"/><i className="h-full flex-1 rounded-t bg-[var(--tri-brand-luminous)]"/></div></div></div>
          </section>

          <section id="system" className="pt-[var(--tri-space-section)]"><p className="text-[var(--tri-label-eyebrow-size)] uppercase tracking-[var(--tri-label-eyebrow-tracking)] text-[var(--tri-text-accent)]">Visual system</p><h2 className="mt-[var(--tri-space-3)] font-[var(--tri-font-display)] text-[var(--tri-text-h2-size)] leading-[var(--tri-text-h2-line-height)] tracking-[var(--tri-text-h2-tracking)]">A composed product rhythm.</h2>
            <div className="mt-[var(--tri-space-6)] grid gap-[var(--tri-grid-gap)] lg:grid-cols-12"><Card className="lg:col-span-7"><h3 className="font-[var(--tri-font-display)] text-[var(--tri-text-h3-size)]">Application shell</h3><p className="text-[var(--tri-text-secondary)]">Dark navigation. Calm workspace. Minimal elevation.</p><div className="mt-[var(--tri-space-5)] grid min-h-64 grid-cols-[56px_1fr] rounded-[var(--tri-radius-md)] bg-[var(--tri-bg-surface-alt)] p-[var(--tri-space-3)]"><div className="grid content-start gap-3 rounded-[var(--tri-radius-sm)] bg-[var(--tri-bg-inverse)] p-3"><i className="size-7 rounded-[var(--tri-radius-sm)] bg-[var(--tri-nav-active-bg)]"/><i className="size-7 rounded-[var(--tri-radius-sm)] bg-[var(--tri-border-subtle)]"/></div><div className="p-[var(--tri-space-4)]"><div className="grid grid-cols-3 gap-2">{["2,840", "98.4%", "146"].map((metric) => <div key={metric} className="rounded-[var(--tri-radius-sm)] border bg-[var(--tri-bg-surface)] p-3"><small className="text-[var(--tri-text-tertiary)]">Metric</small><strong className="block font-[var(--tri-font-display)]">{metric}</strong></div>)}</div><div className="mt-3 flex h-28 items-end gap-2 rounded-[var(--tri-radius-sm)] border bg-[var(--tri-bg-surface)] p-3">{[31,48,42,60,55,76,69,88].map((height, index) => <i key={height} className={`flex-1 rounded-t ${index % 3 === 2 ? "bg-[var(--tri-brand-violet)]" : "bg-[var(--tri-brand-primary)]"}`} style={{ height: `${height}%` }}/>)}</div></div></div></Card>
              <Card className="lg:col-span-5"><h3 className="font-[var(--tri-font-display)] text-[var(--tri-text-h3-size)]">Core palette</h3><div className="mt-[var(--tri-space-5)] grid grid-cols-2 gap-[var(--tri-space-3)]">{swatches.map(([name, color, text]) => <div key={name} className="min-h-24 rounded-[var(--tri-radius-md)] p-[var(--tri-space-3)]" style={{ background: `var(${color})`, color: `var(${text})` }}><strong className="block">{name}</strong><code className="text-[var(--tri-text-caption-size)]">{color}</code></div>)}</div></Card>
              <Card className="lg:col-span-5"><h3 className="font-[var(--tri-font-display)] text-[var(--tri-text-h3-size)]">Typography scale</h3><div className="mt-[var(--tri-space-5)] space-y-3"><p className="font-[var(--tri-font-display)] text-[var(--tri-text-h1-size)] leading-[var(--tri-text-h1-line-height)]">Signal, not noise.</p><p className="text-[var(--tri-text-large-size)]">Large body text brings editorial warmth.</p><p>Base body text keeps product UI crisp.</p><p className="text-[var(--tri-text-small-size)]">Small text supports product detail.</p><p className="text-[var(--tri-text-caption-size)] uppercase tracking-[var(--tri-label-overline-tracking)]">Caption / label / metadata</p></div></Card>
              <Card className="lg:col-span-7"><h3 className="font-[var(--tri-font-display)] text-[var(--tri-text-h3-size)]">Spacing scale</h3><div className="mt-[var(--tri-space-5)] flex flex-wrap items-end gap-3">{[1,2,3,4,6,8,12,16].map((space) => <div key={space} className="grid justify-items-center gap-2"><i className="block bg-[var(--tri-brand-primary)]" style={{ width: `var(--tri-space-${space})`, height: `var(--tri-space-${space})` }}/><code>{space}</code></div>)}</div></Card></div>
          </section>

          <section id="components" className="pt-[var(--tri-space-section)]"><h2 className="font-[var(--tri-font-display)] text-[var(--tri-text-h2-size)]">Component matrix</h2><div className="mt-[var(--tri-space-6)] grid gap-[var(--tri-grid-gap)] lg:grid-cols-2"><Card><h3 className="font-[var(--tri-font-display)] text-[var(--tri-text-h3-size)]">Buttons and badges</h3><div className="mt-4 flex flex-wrap gap-3"><Button>Primary</Button><Button variant="secondary">Secondary</Button><Button variant="ghost">Ghost</Button><Button variant="danger">Delete</Button><IconButton label="Add item">+</IconButton>{["neutral","success","info","warning","danger"].map((tone) => <Badge key={tone} tone={tone as "neutral"}>● {tone}</Badge>)}</div></Card><Card variant="interactive"><h3 className="font-[var(--tri-font-display)] text-[var(--tri-text-h3-size)]">Inputs</h3><div className="mt-4 grid gap-4"><Field label="Workspace name" htmlFor="fixture-name" hint="Visible label and hint."><Input id="fixture-name" defaultValue="Tridorian Studio" /></Field><Field label="Email" htmlFor="fixture-email" error="Enter valid email address."><Input id="fixture-email" invalid defaultValue="not-an-email" /></Field></div></Card><Card variant="featured"><h3 className="font-[var(--tri-font-display)] text-[var(--tri-text-h3-size)]">Featured card</h3><p>Forest focal surface uses tokenized gradient.</p></Card><Card variant="glass"><h3 className="font-[var(--tri-font-display)] text-[var(--tri-text-h3-size)]">Glass utility card</h3><p>Reserved for floating utility panels.</p></Card>
            <Card className="lg:col-span-2"><h3 className="font-[var(--tri-font-display)] text-[var(--tri-text-h3-size)]">Table</h3><div className="mt-4"><Table><TableHeader><TableRow><TableHead>Asset</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody><TableRow><TableCell>Campaign still</TableCell><TableCell><Badge tone="success">Ready</Badge></TableCell><TableCell actions><Button variant="ghost">Open</Button></TableCell></TableRow></TableBody></Table></div></Card>
            <Card><h3 className="font-[var(--tri-font-display)] text-[var(--tri-text-h3-size)]">Tooltip and toast</h3><InteractiveFeedbackSpecimens /></Card><Card><EmptyState title="No assets yet" description="Upload source material to start creating." illustration="◇" actions={<Button>Upload asset</Button>} /></Card></div>
          </section>
        </div>
      </main>
    </div>
    <DialogSpecimen />
  </div>;
}
