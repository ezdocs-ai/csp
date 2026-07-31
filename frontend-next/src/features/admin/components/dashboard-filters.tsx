// Copyright 2025 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.

"use client";

import { useId, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/src/components/ui/input";

/**
 * Cross-linked min/max for the two date inputs: the "From" input cannot pass
 * the chosen end date and the "To" input cannot precede the chosen start date.
 * Pure — unit-tested.
 */
export function dateRangeBounds(start: string, end: string): { fromMax: string | undefined; toMin: string | undefined } {
  return { fromMax: end || undefined, toMin: start || undefined };
}

export function DashboardFilters({ initialStart, initialEnd, today }: { initialStart: string; initialEnd: string; today: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromId = useId();
  const toId = useId();
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);
  const { fromMax, toMin } = dateRangeBounds(start, end);

  const apply = (nextStart: string, nextEnd: string) => {
    const params = new URLSearchParams(searchParams);
    params.delete("range");
    if (nextStart && nextEnd) {
      params.set("start_date", nextStart);
      params.set("end_date", nextEnd);
    } else {
      params.delete("start_date");
      params.delete("end_date");
      params.set("range", "all");
    }
    router.replace(`${pathname}?${params}`);
  };

  const updateStart = (value: string) => {
    setStart(value);
    if (!value) {
      setEnd("");
      apply("", "");
    } else if (end) apply(value, end);
  };

  const updateEnd = (value: string) => {
    setEnd(value);
    if (!value) {
      setStart("");
      apply("", "");
    } else if (start) apply(start, value);
  };

  return (
    <fieldset className="min-w-0 border-0 p-0">
      <legend className="sr-only">Date range</legend>
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid min-w-[8rem] gap-1">
          <label className="text-[length:var(--tri-text-small-size)] font-[var(--tri-font-weight-semibold)] text-[var(--tri-text-secondary)]" htmlFor={fromId}>From</label>
          <Input aria-label="Start date" id={fromId} max={fromMax && fromMax < today ? fromMax : today} onChange={(event) => updateStart(event.target.value)} type="date" value={start} />
        </div>
        <div className="grid min-w-[8rem] gap-1">
          <label className="text-[length:var(--tri-text-small-size)] font-[var(--tri-font-weight-semibold)] text-[var(--tri-text-secondary)]" htmlFor={toId}>To</label>
          <Input aria-label="End date" id={toId} max={today} min={toMin} onChange={(event) => updateEnd(event.target.value)} type="date" value={end} />
        </div>
      </div>
    </fieldset>
  );
}
