'use client';

import { useId } from 'react';

type Common = {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
};

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
}: Common & { children: React.ReactNode; htmlFor?: string }) {
  return (
    <div className={`field${error ? ' bad' : ''}`}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {error ? (
        <p className="err" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="hint">{hint}</p>
      ) : null}
    </div>
  );
}

type InputProps = Common &
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'children'> & { prefix?: string };

export function TextField({ label, hint, error, prefix, type = 'text', ...rest }: InputProps) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} htmlFor={id}>
      {prefix ? (
        <div className="prefix-wrap">
          <span className="prefix">{prefix}</span>
          <input id={id} type={type} aria-invalid={Boolean(error)} {...rest} />
        </div>
      ) : (
        <input id={id} type={type} aria-invalid={Boolean(error)} {...rest} />
      )}
    </Field>
  );
}

export function TextArea({
  label,
  hint,
  error,
  ...rest
}: Common & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'children'>) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} htmlFor={id}>
      <textarea id={id} aria-invalid={Boolean(error)} {...rest} />
    </Field>
  );
}

export function SelectField({
  label,
  hint,
  error,
  children,
  ...rest
}: Common & React.SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} htmlFor={id}>
      <select id={id} aria-invalid={Boolean(error)} {...rest}>
        {children}
      </select>
    </Field>
  );
}

export function Check({
  label,
  ...rest
}: { label: React.ReactNode } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="check">
      <input type="checkbox" {...rest} />
      <span>{label}</span>
    </label>
  );
}

export function Submit({
  busy,
  children,
  className = 'btn btn-accent full',
  ...rest
}: { busy?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="submit" className={className} disabled={busy} aria-busy={busy} {...rest}>
      {busy ? <span className="spinner" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

export function FormError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p className="form-error" role="alert">
      {children}
    </p>
  );
}

export function FormGood({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p className="form-good" role="status">
      {children}
    </p>
  );
}
