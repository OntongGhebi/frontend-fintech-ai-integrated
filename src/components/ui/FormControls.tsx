import { useId } from "react";

import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

export type FieldSize = "sm" | "md" | "lg";

interface FieldPresentationProps {
  label?: string;
  helperText?: string;
  error?: string;
  success?: string;
  fieldSize?: FieldSize;
  wrapperClassName?: string;
}

interface FieldFrameProps extends FieldPresentationProps {
  id: string;
  required?: boolean;
  children: ReactNode;
}

function FieldFrame({
  id,
  label,
  required = false,
  helperText,
  error,
  success,
  wrapperClassName,
  children,
}: FieldFrameProps) {
  const helperId = helperText ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const successId = success ? `${id}-success` : undefined;

  return (
    <div
      className={["ui-form-control", wrapperClassName ?? ""]
        .filter(Boolean)
        .join(" ")}
    >
      {label && (
        <label className="ui-label" htmlFor={id}>
          {label}

          {required && (
            <span className="ui-label__required" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}

      {children}

      {helperText && (
        <p id={helperId} className="ui-field-help">
          {helperText}
        </p>
      )}

      {error && (
        <p id={errorId} className="ui-field-error" role="alert">
          {error}
        </p>
      )}

      {!error && success && (
        <p id={successId} className="ui-field-success" role="status">
          {success}
        </p>
      )}
    </div>
  );
}

function getFieldClasses(
  fieldSize: FieldSize,
  className?: string,
  error?: string,
  success?: string,
  readOnly?: boolean,
): string {
  return [
    "ui-field",
    `ui-field--${fieldSize}`,
    error ? "ui-field--error" : "",
    !error && success ? "ui-field--success" : "",
    readOnly ? "ui-field--readonly" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
}

function getDescribedBy(
  customDescription: string | undefined,
  id: string,
  helperText?: string,
  error?: string,
  success?: string,
): string | undefined {
  const descriptions = [
    customDescription,
    helperText ? `${id}-help` : undefined,
    error ? `${id}-error` : undefined,
    !error && success ? `${id}-success` : undefined,
  ].filter(Boolean);

  return descriptions.length > 0 ? descriptions.join(" ") : undefined;
}

/* =========================================================
   INPUT FIELD
   ========================================================= */

export interface InputFieldProps
  extends
    Omit<InputHTMLAttributes<HTMLInputElement>, "size">,
    FieldPresentationProps {}

export function InputField({
  id,
  label,
  helperText,
  error,
  success,
  fieldSize = "md",
  wrapperClassName,
  className,
  required,
  readOnly,
  disabled,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  ...inputProps
}: InputFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;

  const describedBy = getDescribedBy(
    ariaDescribedBy,
    fieldId,
    helperText,
    error,
    success,
  );

  return (
    <FieldFrame
      id={fieldId}
      label={label}
      required={required}
      helperText={helperText}
      error={error}
      success={success}
      wrapperClassName={wrapperClassName}
    >
      <input
        {...inputProps}
        id={fieldId}
        required={required}
        readOnly={readOnly}
        disabled={disabled}
        className={getFieldClasses(
          fieldSize,
          className,
          error,
          success,
          readOnly,
        )}
        aria-invalid={error ? true : ariaInvalid}
        aria-describedby={describedBy}
      />
    </FieldFrame>
  );
}

/* =========================================================
   SELECT FIELD
   ========================================================= */

export interface SelectFieldProps
  extends SelectHTMLAttributes<HTMLSelectElement>, FieldPresentationProps {}

export function SelectField({
  id,
  label,
  helperText,
  error,
  success,
  fieldSize = "md",
  wrapperClassName,
  className,
  required,
  disabled,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  children,
  ...selectProps
}: SelectFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;

  const describedBy = getDescribedBy(
    ariaDescribedBy,
    fieldId,
    helperText,
    error,
    success,
  );

  return (
    <FieldFrame
      id={fieldId}
      label={label}
      required={required}
      helperText={helperText}
      error={error}
      success={success}
      wrapperClassName={wrapperClassName}
    >
      <select
        {...selectProps}
        id={fieldId}
        required={required}
        disabled={disabled}
        className={getFieldClasses(fieldSize, className, error, success)}
        aria-invalid={error ? true : ariaInvalid}
        aria-describedby={describedBy}
      >
        {children}
      </select>
    </FieldFrame>
  );
}

/* =========================================================
   TEXTAREA FIELD
   ========================================================= */

export interface TextareaFieldProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement>, FieldPresentationProps {}

export function TextareaField({
  id,
  label,
  helperText,
  error,
  success,
  fieldSize = "md",
  wrapperClassName,
  className,
  required,
  readOnly,
  disabled,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  ...textareaProps
}: TextareaFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;

  const describedBy = getDescribedBy(
    ariaDescribedBy,
    fieldId,
    helperText,
    error,
    success,
  );

  return (
    <FieldFrame
      id={fieldId}
      label={label}
      required={required}
      helperText={helperText}
      error={error}
      success={success}
      wrapperClassName={wrapperClassName}
    >
      <textarea
        {...textareaProps}
        id={fieldId}
        required={required}
        readOnly={readOnly}
        disabled={disabled}
        className={getFieldClasses(
          fieldSize,
          className,
          error,
          success,
          readOnly,
        )}
        aria-invalid={error ? true : ariaInvalid}
        aria-describedby={describedBy}
      />
    </FieldFrame>
  );
}
