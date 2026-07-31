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

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  GIS_CONFIG,
  GIS_SCRIPT_URL,
  type GoogleCredentialResponse,
} from "@/src/lib/auth/gis";

export function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const buttonRef = useRef<HTMLDivElement>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const configError = GIS_CONFIG.client_id ? null : "NEXT_PUBLIC_GOOGLE_CLIENT_ID is not configured.";

  const handleCredential = useCallback(
    async (response: GoogleCredentialResponse) => {
      setSubmitError(null);
      try {
        const csrfResponse = await fetch("/api/auth/csrf");
        const csrf = (await csrfResponse.json()) as { csrfToken?: string; error?: string };
        if (!csrfResponse.ok || !csrf.csrfToken) throw new Error(csrf.error ?? "Could not initialize login");

        const login = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            credential: response.credential,
            csrfToken: csrf.csrfToken,
          }),
        });
        const result = (await login.json()) as { error?: string };
        if (!login.ok) throw new Error(result.error ?? "Login rejected");
        router.push(next);
        router.refresh();
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : "Sign-in failed. Please try again.");
      }
    },
    [next, router],
  );

  useEffect(() => {
    if (configError) return;
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${GIS_SCRIPT_URL}"]`,
    );
    const script = existing ?? document.createElement("script");
    script.src = GIS_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    if (!existing) document.head.appendChild(script);

    function onScriptLoad() {
      if (!window.google?.accounts?.id || !buttonRef.current) return;
      window.google.accounts.id.initialize({
        ...GIS_CONFIG,
        callback: handleCredential,
      });
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: "filled_blue",
        size: "large",
        shape: "pill",
        width: 280,
      });
    }

    if (script.dataset.loaded === "true") onScriptLoad();
    else script.addEventListener("load", onScriptLoad);

    return () => script.removeEventListener("load", onScriptLoad);
  }, [configError, handleCredential]);

  const error = configError ?? submitError;

  return (
    <div className="flex w-full flex-col items-center gap-4">
      {error && (
        <p
          role="alert"
          className="text-xs text-red-400 font-semibold max-w-[280px]"
        >
          {error}
        </p>
      )}
      <div ref={buttonRef} className="min-h-[44px] flex justify-center w-full" />
    </div>
  );
}
