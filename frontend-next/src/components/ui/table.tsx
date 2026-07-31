/* Copyright 2025 Google LLC
 * Licensed under Apache-2.0
 */
import type { HTMLAttributes, TableHTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";
export interface TableProps extends TableHTMLAttributes<HTMLTableElement> { stickyHeader?: boolean; }
export function Table({ children, className = "", stickyHeader = false, ...props }: TableProps) { return <div className={`w-full ${stickyHeader ? "max-h-[70vh] overflow-auto" : "overflow-x-auto"}`}><table className={`w-full min-w-max border-collapse text-left ${className}`} data-sticky-header={stickyHeader || undefined} {...props}>{children}</table></div>; }
export function TableHeader({ className = "", sticky = false, ...props }: HTMLAttributes<HTMLTableSectionElement> & { sticky?: boolean }) { return <thead className={`h-[var(--tri-table-header-height)] bg-[var(--tri-table-header-bg)] text-[var(--tri-table-header-fg)] text-[var(--tri-label-overline-size)] uppercase tracking-[var(--tri-label-overline-tracking)] ${sticky ? "sticky top-0 z-10" : ""} ${className}`} {...props} />; }
export function TableBody(props: HTMLAttributes<HTMLTableSectionElement>) { return <tbody {...props} />; }
export function TableRow({ className = "", ...props }: HTMLAttributes<HTMLTableRowElement>) { return <tr className={`min-h-[var(--tri-table-row-min-height)] border-b border-[var(--tri-table-row-divider)] transition-[var(--tri-button-transition)] hover:bg-[var(--tri-table-row-hover)] ${className}`} {...props} />; }
export function TableHead({ className = "", ...props }: ThHTMLAttributes<HTMLTableCellElement>) { return <th className={`px-[var(--tri-space-4)] py-[var(--tri-space-3)] font-[var(--tri-font-weight-bold)] ${className}`} {...props} />; }
export function TableCell({ className = "", actions = false, ...props }: TdHTMLAttributes<HTMLTableCellElement> & { actions?: boolean }) { return <td className={`px-[var(--tri-space-4)] py-[var(--tri-space-2)] ${actions ? "min-w-[var(--tri-control-height-md)] text-right" : ""} ${className}`} {...props} />; }
