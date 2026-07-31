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
  Inter,
  JetBrains_Mono,
  Readex_Pro,
  Space_Grotesk,
} from "next/font/google";

import { getSession } from "@/src/lib/auth/server";
import { createApiClient } from "@/src/lib/api";
import { listWorkspaces, type Workspace } from "@/src/lib/workspace";

import "./globals.css";
import { Providers } from "./providers";

const display = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
});

const sans = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

const editorial = Readex_Pro({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-editorial",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Creative Studio",
  description:
    "Google Cloud generative-media studio for Imagen, Veo, Lyria, Chirp and more.",
};



export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession();
  let initialWorkspaces: Workspace[] = [];
  if (session) {
    try {
      const api = createApiClient({
        baseUrl: process.env.BACKEND_URL ?? "",
        getHeaders: () => ({ Authorization: `Bearer ${session.idToken}` }),
      });
      initialWorkspaces = await listWorkspaces(api);
    } catch {
      // Best-effort SSR prefetch; WorkspaceProvider exposes refresh() for retry.
    }
  }
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${editorial.variable} ${mono.variable}`}
      data-theme="light"
    >
      <body>
        <Providers initialWorkspaces={initialWorkspaces}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
