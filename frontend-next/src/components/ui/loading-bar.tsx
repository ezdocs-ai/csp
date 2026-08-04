/** Copyright 2026 Google LLC — Apache-2.0 */
"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Fixed-top indeterminate progress bar shown briefly on route changes.
 * Mirrors Angular's `mat-progress-bar` bound to `loadingService.isLoading$`.
 * Self-contained: ships its own keyframe so `globals.css` is untouched.
 */
export function LoadingBar() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const prev = useRef(pathname);

  useEffect(() => {
    if (prev.current === pathname) return;
    prev.current = pathname;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 500);
    return () => clearTimeout(t);
  }, [pathname]);

  if (!visible) return null;
  return (
    <>
      <style>{`@keyframes tri-loading{0%{transform:translateX(-100%)}100%{transform:translateX(400%)}}`}</style>
      <div
        aria-hidden
        className="fixed inset-x-0 top-0 z-[9999] h-[3px] overflow-hidden bg-[var(--tri-brand-primary)]/20"
        role="progressbar"
      >
        <div className="h-full w-1/3 bg-[image:var(--tri-gradient-brand-text)]" style={{ animation: "tri-loading 1.1s ease-in-out infinite"}} />
      </div>
    </>
  );
}
