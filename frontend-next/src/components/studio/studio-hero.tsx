/* Copyright 2026 Google LLC
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
"use client";

import type { ReactNode } from "react";

export interface StudioHeroProps {
  title: string;
  subtitle?: string;
  /** Decorative icon node (e.g. spark). Shown only when no `videoSrc`. */
  icon?: ReactNode;
  /** Video feature: centered autoplay muted loop video (Angular "Generate Video Ads"). */
  videoSrc?: string;
  /** Audio feature: full-bleed background video (Angular abstract-waves). */
  backgroundVideoSrc?: string;
}

export function StudioHero({ backgroundVideoSrc, icon, subtitle, title, videoSrc }: StudioHeroProps) {
  const hasBackgroundVideo = !!backgroundVideoSrc;
  return (
    <section
      className={`relative flex w-full flex-col items-center justify-center overflow-hidden rounded-3xl px-6 py-12 text-center ${
        hasBackgroundVideo ? "" : "bg-gradient-to-br from-[var(--tri-brand-violet)]/20 via-[var(--tri-bg-surface)] to-[var(--tri-bg-surface)]"
      }`}
    >
      {hasBackgroundVideo ? (
        <>
          <video
            aria-hidden
            autoPlay
            className="absolute inset-0 size-full object-cover"
            loop
            muted
            playsInline
          >
            <source src={backgroundVideoSrc} />
          </video>
          <div aria-hidden className="absolute inset-0 bg-[var(--tri-bg-scrim)]" />
        </>
      ) : null}
      <div className="relative flex flex-col items-center gap-3">
        {videoSrc ? (
          <video autoPlay className="max-h-64 w-auto rounded-2xl" loop muted playsInline>
            <source src={videoSrc} />
          </video>
        ) : (
          icon
        )}
        <h1 className="font-[var(--tri-font-display)] text-3xl font-bold md:text-4xl">
          <span className="bg-[image:var(--tri-gradient-brand-text)] bg-clip-text text-transparent">
            {title}
          </span>
        </h1>
        {subtitle ? (
          <p className="max-w-xl text-sm text-[var(--tri-text-secondary)]">{subtitle}</p>
        ) : null}
      </div>
    </section>
  );
}
