import type { InputHTMLAttributes, ReactNode } from "react";
export function Field({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label>
      {label}
      <input {...props} />
    </label>
  );
}
export function Select({
  label,
  name,
  children,
  defaultValue,
  required = true,
}: {
  label: string;
  name: string;
  children: ReactNode;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <label>
      {label}
      <select
        aria-label={label}
        name={name}
        defaultValue={defaultValue}
        required={required}
      >
        {children}
      </select>
    </label>
  );
}
export function Hidden({ firm, matter }: { firm: string; matter?: string }) {
  return (
    <>
      <input type="hidden" name="firm" value={firm} />
      {matter && <input type="hidden" name="matter" value={matter} />}
    </>
  );
}
