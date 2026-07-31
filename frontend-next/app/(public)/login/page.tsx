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

import { Suspense } from "react";
import { redirect } from "next/navigation";

import { getSession } from "@/src/lib/auth/server";

import { LoginClient } from "./login-client";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/");

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-5 text-white lg:grid-cols-2">
      <video
        aria-hidden="true"
        autoPlay
        className="absolute inset-0 size-full object-cover z-0"
        loop
        muted
        playsInline
        preload="metadata"
      >
        <source src="/assets/videos/google-deepmind-veo3.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-black/40 z-[1]" />

      {/* Left Column (Desktop view) */}
      <div className="hidden lg:flex flex-col justify-center items-center gap-4 z-10 text-center">
        <p className="text-4xl font-light font-display leading-tight tracking-tight select-none">
          <span className="font-extrabold bg-gradient-to-r from-[#4285F4] via-[#a488f5] to-[#EA4335] bg-clip-text text-transparent">
            Create
          </span>{" "}
          at the speed <br />
          of{" "}
          <span className="font-extrabold bg-gradient-to-r from-[#4285F4] via-[#a488f5] to-[#EA4335] bg-clip-text text-transparent">
            thought
          </span>{" "}
          🚀
        </p>
      </div>

      {/* Right Column (Login card) */}
      <div className="flex flex-col justify-center items-center gap-4 z-10 w-full px-4">
        <section className="relative z-10 flex w-full max-w-[400px] flex-col gap-6 rounded-2xl border border-white/20 bg-white/10 p-8 shadow-xl backdrop-blur-md text-center">
          <header className="flex flex-col gap-2">
            <h1 className="text-4xl font-normal font-display tracking-tight text-white select-none">
              Creative{" "}
              <span className="font-extrabold bg-gradient-to-r from-[#4285F4] via-[#a488f5] to-[#EA4335] bg-clip-text text-transparent">
                Studio
              </span>
            </h1>
            <p className="text-sm font-light text-white/80 mt-2">
              Single Sign on with your Google Account
            </p>
          </header>
          
          <Suspense fallback={<p className="text-center text-sm text-white/70">Loading sign-in…</p>}>
            <LoginClient />
          </Suspense>
        </section>
      </div>
    </main>
  );
}
