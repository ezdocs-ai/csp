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
import { Menu, MenuItem, Tooltip } from "@/src/components/ui";

export interface OptionToolbarOption {
  value: string;
  label: string;
  selected?: boolean;
  disabled?: boolean;
}

export interface OptionToolbarItem {
  id: string;
  icon: ReactNode;
  /** Visible caption rendered under the button. */
  label: string;
  /** Hover tooltip. */
  tooltip: string;
  kind: "menu" | "toggle";
  /** Toggle active state, or whether a menu has a value selected. */
  selected?: boolean;
  disabled?: boolean;
  /** Menu options. */
  options?: OptionToolbarOption[];
  onSelect?: (value: string) => void;
  /** Toggle handler. */
  onToggle?: () => void;
  /** Escape hatch for non-option menus (e.g. negative-phrases chip grid). */
  customMenu?: ReactNode;
}

export interface OptionToolbarProps {
  items: OptionToolbarItem[];
}

export function OptionToolbar({ items }: OptionToolbarProps) {
  return (
    <div
      aria-label="Generation options"
      className="grid grid-cols-2 gap-x-8 gap-y-6 py-4 md:grid-cols-3 lg:flex lg:flex-wrap lg:items-start lg:justify-center"
      role="toolbar"
    >
      {items.map((item) => (
        <ToolbarEntry item={item} key={item.id} />
      ))}
    </div>
  );
}

function ToolbarEntry({ item }: { item: OptionToolbarItem }) {
  const active = !!item.selected;
  const circleClass = `flex size-14 items-center justify-center rounded-full border transition-all duration-[var(--tri-duration-fast)] hover:scale-105 active:scale-95 ${
    active
      ? "border-[var(--tri-brand-primary)] bg-[var(--tri-bg-surface-tint)] text-[var(--tri-brand-primary)] shadow-[var(--tri-shadow-sm)]"
      : "border-[var(--tri-border-default)] bg-[var(--tri-bg-surface)] text-[var(--tri-text-secondary)] hover:border-[var(--tri-brand-primary)] hover:bg-[var(--tri-bg-surface-alt)] shadow-[var(--tri-shadow-xs)]"
  } ${item.disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"}`;
  const trigger = <span className={circleClass}>{item.icon}</span>;
  return (
    <div className="flex flex-col items-center">
      {item.kind === "menu" ? (
        <Menu
          align="start"
          className="inline-block"
          label={item.label}
          panelClassName={item.customMenu ? "min-w-[20rem]" : undefined}
          side="bottom"
          trigger={trigger}
        >
          {item.customMenu
            ? item.customMenu
            : item.options?.map((option) => (
                <MenuItem
                  disabled={option.disabled || item.disabled}
                  key={option.value}
                  onClick={() => item.onSelect?.(option.value)}
                  selected={option.selected}
                >
                  {option.label}
                </MenuItem>
              ))}
        </Menu>
      ) : (
        <button
          aria-label={item.label}
          aria-pressed={item.selected}
          disabled={item.disabled}
          onClick={item.onToggle}
          type="button"
        >
          {trigger}
        </button>
      )}
      <Tooltip content={item.tooltip}>
        <span className="mt-2 max-w-28 select-none truncate text-center text-[13px] text-[var(--tri-text-secondary)]">
          {item.label}
        </span>
      </Tooltip>
    </div>
  );
}
