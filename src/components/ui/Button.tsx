import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "outline"
  | "subtle";

export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  iconOnly?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

/**
 * Shared button primitive.
 *
 * Use className only for page-specific layout adjustments.
 * Visual variants, sizing, disabled state, and loading behavior
 * should come from this component.
 *
 * For icon-only buttons, always provide an accessible name
 * through aria-label.
 */
export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  fullWidth = false,
  iconOnly = false,
  leadingIcon,
  trailingIcon,
  className,
  children,
  type = "button",
  disabled,
  "aria-busy": ariaBusy,
  ...buttonProps
}: ButtonProps) {
  const classes = [
    "ui-button",
    `ui-button--${variant}`,
    `ui-button--${size}`,
    fullWidth ? "ui-button--full" : "",
    iconOnly ? "ui-button--icon" : "",
    loading ? "ui-button--loading" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      {...buttonProps}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || ariaBusy}
    >
      {loading ? (
        <span className="ui-button__spinner" aria-hidden="true" />
      ) : (
        leadingIcon
      )}

      {children}

      {!loading && trailingIcon}
    </button>
  );
}
