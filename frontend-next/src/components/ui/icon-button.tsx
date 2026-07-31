/* Copyright 2025 Google LLC
 * Licensed under Apache-2.0
 */
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Button } from "./button";

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> { children: ReactNode; label: string; }
export function IconButton({ children, label, ...props }: IconButtonProps) {
  return <Button aria-label={label} title={label} variant="iconOnly" {...props}>{children}</Button>;
}
