import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "default" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({
  variant = "default",
  size = "md",
  className = "",
  type = "button",
  ...rest
}: ButtonProps) {
  const cls = `gb-btn gb-btn--${variant} gb-btn--${size} ${className}`.trim();
  return <button type={type} className={cls} {...rest} />;
}
